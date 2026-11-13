import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import {
  HotelBooking,
  HotelBookingDocument,
} from './schemas/hotel-booking.schema';
import {
  RoomNight,
  RoomNightDocument,
} from './schemas/room-night.schema';
import { Room, RoomDocument } from '../hotels/schemas/room.schema';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { HotelSearchService } from '../hotels/hotel-search.service';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { eachNight, nightsBetween, overlaps } from './stay.util';
import type { UserDocument } from '../users/schemas/user.schema';

export const HOLD_MINUTES = 10;

@Injectable()
export class HotelBookingsService {
  constructor(
    @InjectModel(HotelBooking.name)
    private bookings: Model<HotelBookingDocument>,
    @InjectModel(RoomNight.name)
    private nights: Model<RoomNightDocument>,
    @InjectModel(Room.name)
    private rooms: Model<RoomDocument>,
    @InjectModel(Hotel.name)
    private hotels: Model<HotelDocument>,
    private readonly search: HotelSearchService,
  ) {}

  /** Releases the claimed nights of one booking (expiry or cancellation). */
  release(bookingId: any) {
    return this.nights.deleteMany({ booking: bookingId });
  }

  async expireBooking(b: HotelBookingDocument) {
    const claimed = await this.bookings.findOneAndUpdate(
      { _id: b._id, status: BookingStatus.PENDING_PAYMENT },
      { status: BookingStatus.EXPIRED },
      { returnDocument: 'after' },
    );
    if (claimed) await this.release(claimed._id);
  }

  /** Runs every minute; also called before a new hold so a stale hold never blocks a user. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds(roomIds?: any[]) {
    const filter: any = {
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: { $lte: new Date() },
    };
    if (roomIds) filter['rooms.room'] = { $in: roomIds };
    for (const b of await this.bookings.find(filter)) {
      await this.expireBooking(b);
    }
  }

  async hold(user: UserDocument, dto: CreateHotelBookingDto) {
    const { start, end } = this.search.validateDates(dto.checkIn, dto.checkOut);
    const roomIds = dto.rooms.map((r) => r.roomId);
    if (new Set(roomIds).size !== roomIds.length) {
      throw new BadRequestException('A room can only be selected once');
    }
    const hotel = await this.hotels.findById(dto.hotelId);
    if (!hotel || !hotel.isActive) {
      throw new BadRequestException('Hotel not found or not bookable');
    }
    const rooms = await this.rooms.find({
      _id: { $in: roomIds },
      hotel: dto.hotelId,
    });
    if (rooms.length !== roomIds.length) {
      throw new BadRequestException('All rooms must belong to the same hotel');
    }

    // guests: at least one adult overall, no room above its maximum occupancy
    if (dto.rooms.reduce((s, r) => s + r.adults, 0) < 1) {
      throw new BadRequestException('At least one adult is required');
    }
    for (const g of dto.rooms) {
      const room = rooms.find((r) => r.id === g.roomId)!;
      if (g.adults + g.childAges.length > room.maxOccupancy) {
        throw new BadRequestException(
          `Room ${room.roomNumber} holds at most ${room.maxOccupancy} guests`,
        );
      }
      if (g.adults + g.childAges.length < 1) {
        throw new BadRequestException(
          `Room ${room.roomNumber} needs at least one guest`,
        );
      }
    }

    // offered, active and not blocked (cheap checks before touching the claims)
    for (const room of rooms) {
      const offered = room.availableRanges.some(
        (a) => a.start <= start && a.end >= end,
      );
      if (
        !room.isActive ||
        !offered ||
        room.blockedRanges.some((b) => overlaps({ start, end }, b))
      ) {
        throw new ConflictException(
          `Room ${room.roomNumber} is not available for these dates`,
        );
      }
    }

    await this.expireHolds(rooms.map((r) => r._id));
    const bookingId = new Types.ObjectId();
    const claims = rooms.flatMap((room) =>
      eachNight(start, end).map((date) => ({
        room: room._id,
        date,
        booking: bookingId,
      })),
    );

    try {
      await this.nights.insertMany(claims, { ordered: false }); // unique (room,date): duplicates
      // are rejected by MongoDB
    } catch (e: any) {
      await this.release(bookingId); // all-or-nothing (HTL-18): remove whatever was inserted
      if (e?.code === 11000 || e?.writeErrors) {
        throw new ConflictException(
          'One of the rooms is already reserved or held for these dates',
        );
      }
      throw e;
    }

    try {
      const nightsCount = nightsBetween(start, end);
      const lines = dto.rooms.map((g) => ({
        room: g.roomId,
        pricePerNight: rooms.find((r) => r.id === g.roomId)!.pricePerNight,
        adults: g.adults,
        childAges: g.childAges,
      }));
      const total = lines.reduce(
        (s, l) => s + l.pricePerNight * nightsCount,
        0,
      );
      return await this.bookings.create({
        _id: bookingId,
        user: user._id,
        hotel: hotel._id,
        rooms: lines,
        checkIn: start,
        checkOut: end,
        nights: nightsCount,
        totalPrice: Math.round(total * 100) / 100,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      });
    } catch (e) {
      await this.release(bookingId);
      throw e;
    }
  }
}
