import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Itinerary, ItineraryDocument } from './schemas/itinerary.schema';
import { CreateItineraryDto, UpdateItineraryDto } from './dto/itinerary.dto';
import { toItineraryView } from './itinerary.view';
import { UserDocument } from '../users/schemas/user.schema';
import { ReferenceDataService } from '../reference-data/reference-data.service';
import { assertOwnership } from '../common/utils/ownership';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';

const toStartDate = (day: string) => new Date(`${day}T00:00:00.000Z`);

@Injectable()
export class ItinerariesService {
  constructor(
    @InjectModel(Itinerary.name) public model: Model<ItineraryDocument>,
    private readonly ref: ReferenceDataService,
  ) {}

  /** ACC-11: loads the itinerary and makes sure it belongs to the logged-in user (404 for anyone else). */
  async getOwned(user: UserDocument, id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Itinerary not found');
    const it = await this.model.findById(id);
    return assertOwnership(it, (i) => i.user.toString(), user, { notFoundMessage: 'Itinerary not found' });
  }

  /** Countries must come from the predefined list. */
  private async checkCountries(ids: string[]) {
    for (const id of ids) {
      if (!(await this.ref.findCountry(id))) throw new BadRequestException(`Unknown country ${id}`);
    }
  }

  async create(user: UserDocument, dto: CreateItineraryDto) {
    await this.checkCountries(dto.countries);
    const it = await this.model.create({
      user: user._id,
      title: dto.title,
      countries: dto.countries,
      startDate: toStartDate(dto.startDate),
    });
    return toItineraryView(it);
  }

  async update(user: UserDocument, id: string, dto: UpdateItineraryDto) {
    const it = await this.getOwned(user, id);
    if (dto.countries) {
      await this.checkCountries(dto.countries);
      it.countries = dto.countries;
    }
    if (dto.title !== undefined) it.title = dto.title;
    if (dto.startDate) it.startDate = toStartDate(dto.startDate); // day dates follow automatically
    if (dto.visibility !== undefined) it.visibility = dto.visibility; // ITN-20
    await it.save();
    return toItineraryView(it);
  }

  async remove(user: UserDocument, id: string) {
    const it = await this.getOwned(user, id);
    await it.deleteOne(); // clones are separate documents and stay untouched
    return { deleted: true };
  }

  /** ITN-03: my itineraries, most recently updated first. */
  async listMine(user: UserDocument, page = 1) {
    const filter = { user: user._id };
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(getSkip(page)).limit(PAGE_SIZE),
      this.model.countDocuments(filter),
    ]);
    const rows = items.map((it) => ({
      _id: it.id,
      title: it.title,
      countries: it.countries,
      startDate: it.startDate,
      days: it.days.length,
      visibility: it.visibility,
    }));
    return buildPage(rows, total, page);
  }

  async findMine(user: UserDocument, id: string) {
    return toItineraryView(await this.getOwned(user, id));
  }
}