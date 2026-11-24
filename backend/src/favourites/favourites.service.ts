import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { UserStatus } from '../common/enums/user-status.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { Visibility } from '../itineraries/schemas/itinerary.schema';
import type { UserDocument } from '../users/schemas/user.schema';
import { AddFavouriteDto, FavouriteParamsDto, ListFavouritesDto } from './dto/favourites.dto';
import { Favourite, FavouriteDocument, FavouriteType } from './schemas/favourite.schema';

/**
 * BON-02: a registered user saves hotels and public itineraries to a favourites list.
 * Hotel and Itinerary are team models, read by model name (like the admin bookings service).
 */
@Injectable()
export class FavouritesService {
  constructor(
    @InjectModel(Favourite.name) private readonly model: Model<FavouriteDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Only active hotels and public, non-hidden itineraries of active users can be saved. */
  private async assertSavable(type: FavouriteType, id: string) {
    if (type === FavouriteType.HOTEL) {
      const ok = await this.connection.model('Hotel').exists({ _id: id, isActive: true });
      if (!ok) throw new NotFoundException('Hotel not found');
      return;
    }

    const it = (await this.connection
      .model('Itinerary')
      .findOne({ _id: id, visibility: Visibility.PUBLIC, hidden: false })
      .select('user')
      .lean()) as { user: Types.ObjectId } | null;
    if (!it) throw new NotFoundException('Public itinerary not found');

    const ownerActive = await this.connection
      .model('User')
      .exists({ _id: it.user, status: { $ne: UserStatus.DEACTIVATED } });
    if (!ownerActive) throw new NotFoundException('Public itinerary not found');
  }

  async add(user: UserDocument, dto: AddFavouriteDto) {
    await this.assertSavable(dto.type, dto.id);
    try {
      const fav = await this.model.create({ user: user._id, type: dto.type, item: dto.id });
      return {
        type: fav.type,
        id: String(fav.item),
        savedAt: (fav as FavouriteDocument & { createdAt?: Date }).createdAt,
      };
    } catch (e) {
      if ((e as { code?: number }).code === 11000) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'ALREADY_FAVOURITE',
          message: 'This item is already in your favourites',
        });
      }
      throw e;
    }
  }

  /** My favourites, newest first, 10 per page (GEN-05). */
  async list(user: UserDocument, query: ListFavouritesDto) {
    const page = query.page ?? 1;
    const filter: Record<string, unknown> = { user: user._id };
    if (query.type) filter.type = query.type;

    const [favs, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(getSkip(page)).limit(PAGE_SIZE).lean() as Promise<any[]>,
      this.model.countDocuments(filter),
    ]);

    const idsOf = (type: FavouriteType) => favs.filter((f) => f.type === type).map((f) => f.item);
    const hotelIds = idsOf(FavouriteType.HOTEL);
    const itineraryIds = idsOf(FavouriteType.ITINERARY);

    const [hotels, itineraries]: any[][] = await Promise.all([
      hotelIds.length
        ? this.connection
            .model('Hotel')
            .find({ _id: { $in: hotelIds } })
            .select('name city country starClass photos ratingAverage isActive')
            .lean()
        : [],
      itineraryIds.length
        ? this.connection
            .model('Itinerary')
            .find({ _id: { $in: itineraryIds } })
            .select('title countries startDate days visibility hidden user')
            .populate('user', 'name status') // only these two fields, never the password hash
            .lean()
        : [],
    ]);

    const hotelMap = new Map(hotels.map((h) => [String(h._id), h]));
    const itineraryMap = new Map(itineraries.map((it) => [String(it._id), it]));

    const items = favs.map((f) => {
      const id = String(f.item);
      if (f.type === FavouriteType.HOTEL) {
        const h = hotelMap.get(id);
        return {
          type: f.type,
          id,
          savedAt: f.createdAt,
          available: !!h?.isActive, // false if the hotel was deactivated (ACC-15)
          item: h
            ? {
                name: h.name,
                city: h.city,
                country: h.country,
                starClass: h.starClass,
                ratingAverage: h.ratingAverage,
                photo: h.photos?.[0],
              }
            : null,
        };
      }

      const it = itineraryMap.get(id);
      // An itinerary that became private, hidden or whose owner left is not shown anymore
      const visible =
        !!it && it.visibility === Visibility.PUBLIC && !it.hidden && it.user?.status !== UserStatus.DEACTIVATED;
      return {
        type: f.type,
        id,
        savedAt: f.createdAt,
        available: visible,
        item: visible
          ? {
              title: it.title,
              countries: it.countries,
              startDate: it.startDate,
              days: it.days?.length ?? 0,
              author: it.user?.name,
            }
          : null,
      };
    });

    return buildPage(items, total, page);
  }

  async remove(user: UserDocument, params: FavouriteParamsDto) {
    const result = await this.model.deleteOne({ user: user._id, type: params.type, item: params.id });
    if (result.deletedCount === 0) throw new NotFoundException('This item is not in your favourites');
    return { removed: true };
  }
}
