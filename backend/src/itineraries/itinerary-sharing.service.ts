import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, PipelineStage, Types } from 'mongoose';
import { ItinerariesService } from './itineraries.service';
import { Visibility } from './schemas/itinerary.schema';
import { SearchPublicItinerariesDto } from './dto/public-search.dto';
import { toItineraryView } from './itinerary.view';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserStatus } from '../common/enums/user-status.enum';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';

const DELETED_NAME = 'Deleted user';

@Injectable()
export class ItinerarySharingService {
  constructor(
    private readonly its: ItinerariesService,
    private readonly ref: ReferenceDataService,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
  ) {}

  /**
   * ITN-21: search public itineraries. Hidden ones (GEN-10) and ones whose owner deactivated the
   * account (ACC-12) never show up. Private ones are never matched at all.
   */
    async search(q: SearchPublicItinerariesDto) {
    if (q.minDays && q.maxDays && q.minDays > q.maxDays) {
      throw new BadRequestException('minDays cannot be greater than maxDays');
    }

    const match: Record<string, unknown> = { visibility: Visibility.PUBLIC, hidden: { $ne: true } };
    if (q.country) match.countries = q.country;
    if (q.city) match['days.city'] = q.city;
    if (q.minDays || q.maxDays) {
      match.daysCount = {
        ...(q.minDays ? { $gte: q.minDays } : {}),
        ...(q.maxDays ? { $lte: q.maxDays } : {}),
      };
    }
    if (q.q) {
      // keyword: title, or the NAME of a country or city (itineraries only store their ids)
      const needle = q.q.toLowerCase();
      const [countries, cities] = await Promise.all([this.ref.listCountries(), this.ref.listCities()]);
      const countryIds = countries.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c._id);
      const cityIds = cities.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c._id);
      const title = new RegExp(q.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [{ title }, { countries: { $in: countryIds } }, { 'days.city': { $in: cityIds } }];
    }

    // ACC-12: skip itineraries whose owner deactivated the account
    const deactivated = await this.users.find({ status: UserStatus.DEACTIVATED }).distinct('_id');
    match.user = { $nin: deactivated };

    const page = q.page;
    const pipeline: PipelineStage[] = [
      { $addFields: { daysCount: { $size: '$days' } } },
      { $match: match },
      {
        $facet: {
          items: [
            { $sort: { updatedAt: -1, _id: -1 } },
            { $skip: getSkip(page) },
            { $limit: PAGE_SIZE },
            {
              $project: {
                title: 1,
                countries: 1,
                startDate: 1,
                days: '$daysCount',
                cities: { $setUnion: ['$days.city', []] },
                user: 1,
                updatedAt: 1,
              },
            },
          ],
          total: [{ $count: 'n' }],
        },
      },
    ];

    const [res] = await this.its.model.aggregate<{
      items: (Record<string, unknown> & { user: Types.ObjectId })[];
      total: { n: number }[];
    }>(pipeline);
    const items = res?.items ?? [];

    // author names: one extra query for the owners of this page
    const owners = await this.users.find({ _id: { $in: items.map((i) => i.user) } }).select('name');
    const nameOf = new Map(owners.map((o) => [o.id, o.name]));
    const rows = items.map(({ user, ...rest }) => ({
      ...rest,
      author: { _id: user, name: nameOf.get(String(user)) ?? DELETED_NAME },
    }));

    return buildPage(rows, res?.total?.[0]?.n ?? 0, page);
  }

  /** A public itinerary, or 404 for private, hidden, deleted or deactivated-owner ones. */
  private async findPublic(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Itinerary not found');
    const it = await this.its.model.findOne({ _id: id, visibility: Visibility.PUBLIC, hidden: { $ne: true } });
    const owner = it ? await this.users.findById(it.user) : null;
    if (!it || !owner || owner.status === UserStatus.DEACTIVATED) throw new NotFoundException('Itinerary not found');
    return { it, owner };
  }

  /** ITN-21: read-only view with author, days, activities and budget entries. */
  async view(id: string) {
    const { it, owner } = await this.findPublic(id);
    const view = toItineraryView(it) as unknown as Record<string, unknown>;
    delete view.user; // never expose the owner's internal id or any private field
    delete view.hidden;
    delete view.originalAuthor;
    delete view.attachedBookings; // ITN-27: attached bookings are private

    let credited: { _id: string; name: string } | null = null;
    if (it.originalAuthor) {
      const o = await this.users.findById(it.originalAuthor);
      credited = {
        _id: String(it.originalAuthor),
        name: o && o.status !== UserStatus.DEACTIVATED ? o.name : DELETED_NAME,
      };
    }
    return { ...view, author: { _id: owner.id, name: owner.name }, originalAuthor: credited };
  }

  /**
   * ITN-21: copy a public itinerary into my account. The clone is private, has new ids everywhere,
   * credits the original author, and is independent: later edits or deletes on either side
   * never touch the other.
   */
  async clone(user: UserDocument, id: string) {
    const { it: src } = await this.findPublic(id);
    const copy = await this.its.model.create({
      user: user._id,
      title: src.title,
      countries: [...src.countries],
      startDate: src.startDate,
      visibility: Visibility.PRIVATE,
      originalAuthor: src.originalAuthor ?? src.user, // cloning a clone credits the very first author
      days: src.days.map((d) => ({
        dayNumber: d.dayNumber,
        city: d.city,
        notes: d.notes,
        activities: d.activities.map((a) => ({
          name: a.name,
          description: a.description,
          time: a.time,
          cost: a.cost,
          costCurrency: a.costCurrency,
          images: a.images.map((img) => ({ url: img.url })), // same files, new image ids
        })),
        budgetEntries: d.budgetEntries.map((b) => ({
          category: b.category,
          amount: b.amount,
          currency: b.currency,
          note: b.note,
        })),
        transports: d.transports.map((t) => ({
          mode: t.mode,
          fromCity: t.fromCity,
          toCity: t.toCity,
          amount: t.amount,
          currency: t.currency,
        })),
      })),
    });
    return toItineraryView(copy);
  }
}