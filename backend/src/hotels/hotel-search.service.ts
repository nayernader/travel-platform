import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Hotel } from './schemas/hotel.schema';
import { Room } from './schemas/room.schema';

import { HotelBooking } from '../hotel-bookings/schemas/hotel-booking.schema';

import { BookingStatus } from '../common/enums/booking-status.enum';

import { SearchHotelsDto } from './dto/search-hotels.dto';

import {
  nightsBetween,
  overlaps,
  parseDay,
  today,
} from '../hotel-bookings/stay.util';

import {
  getSkip,
  PAGE_SIZE,
} from '../common/utils/pagination';

@Injectable()
export class HotelSearchService {
  constructor(
    @InjectModel(Hotel.name)
    private hotels: Model<Hotel>,

    @InjectModel(Room.name)
    private rooms: Model<Room>,

    @InjectModel(HotelBooking.name)
    private bookings: Model<HotelBooking>,
  ) {}

  validateDates(checkIn: string, checkOut: string) {
    const start = parseDay(checkIn);
    const end = parseDay(checkOut);

    if (!(end > start)) {
      throw new BadRequestException(
        'Check-out must be after check-in',
      );
    }

    if (start < today()) {
      throw new BadRequestException(
        'Check-in cannot be in the past',
      );
    }

    return { start, end };
  }

  /**
   * Rooms free for the WHOLE stay:
   * active, offered, not blocked, no Confirmed/unexpired-hold booking.
   */
  async freeRooms(
    hotelIds: Types.ObjectId[],
    start: Date,
    end: Date,
  ) {
    const candidates = await this.rooms.find({
      hotel: { $in: hotelIds },
      isActive: true,
      availableRanges: {
        $elemMatch: {
          start: { $lte: start },
          end: { $gte: end },
        },
      },
    });

    const notBlocked = candidates.filter(
      (r) =>
        !r.blockedRanges.some((b) =>
          overlaps({ start, end }, b),
        ),
    );

    // Find rooms with overlapping confirmed bookings
    // or holds that have not expired.
    const busy = await this.bookings
      .aggregate<{
        rooms: Array<{ room: Types.ObjectId }>;
      }>([
        {
          $match: {
            'rooms.room': {
              $in: notBlocked.map((r) => r._id),
            },
            checkIn: { $lt: end },
            checkOut: { $gt: start },
            $or: [
              {
                status: BookingStatus.CONFIRMED,
              },
              {
                status: BookingStatus.PENDING_PAYMENT,
                holdExpiresAt: { $gt: new Date() },
              },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            rooms: 1,
          },
        },
      ])
      .exec();

    const busyIds = new Set(
      busy.flatMap((booking) =>
        booking.rooms.map((room) =>
          room.room.toString(),
        ),
      ),
    );

    return notBlocked.filter(
      (room) => !busyIds.has(room._id.toString()),
    );
  }

  async search(dto: SearchHotelsDto) {
    if (!dto.city && !dto.country) {
      throw new BadRequestException(
        'Provide city or country',
      );
    }

    if (
      dto.minPrice !== undefined &&
      dto.maxPrice !== undefined &&
      dto.minPrice > dto.maxPrice
    ) {
      throw new BadRequestException(
        'minPrice cannot be greater than maxPrice',
      );
    }

    const { start, end } = this.validateDates(
      dto.checkIn,
      dto.checkOut,
    );

    const wanted = dto.rooms ?? 1;

    const hotels = await this.hotels.find({
      ...(dto.city
        ? { city: dto.city }
        : { country: dto.country }),
      isActive: true,
    });

    const free = await this.freeRooms(
      hotels.map((h) => h._id),
      start,
      end,
    );

    const nights = nightsBetween(start, end);

    const results = [];

    for (const h of hotels) {
      const mine = free.filter(
        (r) => r.hotel.toString() === h._id.toString(),
      );

      if (mine.length < wanted) continue;

      const biggest = [...mine]
        .sort(
          (a, b) => b.maxOccupancy - a.maxOccupancy,
        )
        .slice(0, wanted);

      if (
        biggest.reduce(
          (s, r) => s + r.maxOccupancy,
          0,
        ) < dto.guests
      ) {
        continue;
      }

      const fromPrice = Math.min(
        ...mine.map((r) => r.pricePerNight),
      );

      if (
        dto.minPrice !== undefined &&
        fromPrice < dto.minPrice
      ) {
        continue;
      }

      if (
        dto.maxPrice !== undefined &&
        fromPrice > dto.maxPrice
      ) {
        continue;
      }

      if (
        dto.minRating !== undefined &&
        (h.ratingCount === 0 ||
          h.ratingAverage < dto.minRating)
      ) {
        continue;
      }

      results.push({
        hotel: h,
        fromPrice,
        nights,
        freeRooms: mine.length,
      });
    }

    if (dto.sortBy === 'rating') {
      results.sort(
        (a, b) =>
          b.hotel.ratingAverage - a.hotel.ratingAverage,
      );
    } else {
      results.sort(
        (a, b) => a.fromPrice - b.fromPrice,
      );
    }

    const page = dto.page ?? 1;

    return {
      items: results.slice(
        getSkip(page),
        getSkip(page) + PAGE_SIZE,
      ),
      total: results.length,
      page,
      pageSize: PAGE_SIZE,
      message: results.length
        ? undefined
        : 'No hotels found',
    };
  }

  /** HTL-15: free rooms of one hotel with the total stay price. */
  async availableRooms(
    hotelId: string,
    checkIn: string,
    checkOut: string,
    guests?: number,
  ) {
    const { start, end } = this.validateDates(
      checkIn,
      checkOut,
    );

    if (!(await this.hotels.exists({ _id: hotelId }))) {
      throw new NotFoundException('Hotel not found');
    }

    const nights = nightsBetween(start, end);

    const free = await this.freeRooms(
      [new Types.ObjectId(hotelId)],
      start,
      end,
    );

    return free
      .filter(
        (r) => !guests || r.maxOccupancy >= guests,
      )
      .map((r) => ({
        roomId: r.id,
        roomNumber: r.roomNumber,
        type: r.type,
        beds: r.beds,
        maxOccupancy: r.maxOccupancy,
        pricePerNight: r.pricePerNight,
        nights,
        totalStayPrice:
          Math.round(
            r.pricePerNight * nights * 100,
          ) / 100,
      }));
  }
}