import {
  BadRequestException,
  ConflictException,
<<<<<<< HEAD
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
=======
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
>>>>>>> origin/develop
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
<<<<<<< HEAD
import { HotelSearchService } from '../hotels/hotel-search.service';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { eachNight, nightsBetween, overlaps } from './stay.util';
=======
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { HotelsService } from '../hotels/hotels.service';
import { HotelSearchService } from '../hotels/hotel-search.service';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { eachNight, nightsBetween, overlaps } from './stay.util';
import { refundPercentFor } from '../airlines/cancellation.util';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
>>>>>>> origin/develop
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
<<<<<<< HEAD
=======
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
    private readonly hotelsService: HotelsService,
>>>>>>> origin/develop
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
<<<<<<< HEAD
=======

  private makeReference() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return (
      'HB-' +
      Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)],
      ).join('')
    );
  }

  /** Member 6 calls this before creating a payment. */
  async getPayable(bookingId: string, userId: string) {
    const b = await this.bookings.findOne({ _id: bookingId, user: userId });
    if (!b) throw new NotFoundException('Reservation not found');
    if (
      b.status !== BookingStatus.PENDING_PAYMENT ||
      (b.holdExpiresAt && b.holdExpiresAt <= new Date())
    ) {
      throw new ConflictException(
        'This reservation is no longer waiting for payment',
      );
    }
    return { amount: b.totalPrice, currency: b.currency, status: b.status };
  }

  /** Called by the payment webhook (Member 6) after Stripe confirmed. All rooms confirm together. */
  async confirmPaid(bookingId: string, paymentId: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const b = await this.bookings.findOneAndUpdate(
          { _id: bookingId, status: BookingStatus.PENDING_PAYMENT },
          {
            status: BookingStatus.CONFIRMED,
            reference: this.makeReference(),
            paymentId,
            $unset: { holdExpiresAt: 1 },
          },
          { returnDocument: 'after' },
        );
        if (!b) return null; // expired meanwhile: Member 6 refunds
        await this.notifications.notify(
          b.user,
          NotificationType.BOOKING_CONFIRMED,
          'Hotel reservation confirmed',
          { bookingId: b.id, reference: b.reference },
        );
        return b; // the room-night claims already exist, so the rooms stay reserved
      } catch (e: any) {
        if (e?.code !== 11000) throw e;
      }
    }
    throw new ConflictException('Could not generate a unique reference');
  }

  async findOneFor(user: UserDocument, id: string) {
    const b = await this.bookings
      .findById(id)
      .populate('hotel', 'name address city country checkInTime checkOutTime');
    if (!b) throw new NotFoundException('Reservation not found');
    if (b.user.toString() !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not your reservation'); // ACC-11
    }
    return b;
  }

  async listMine(
    user: UserDocument,
    group: 'upcoming' | 'past' | 'cancelled',
    page = 1,
  ) {
    const filter: any = { user: user._id };
    if (group === 'cancelled') {
      filter.status = {
        $in: [BookingStatus.CANCELLED, BookingStatus.EXPIRED],
      };
    } else if (group === 'past') {
      filter.status = BookingStatus.COMPLETED;
    } else {
      filter.status = {
        $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT],
      };
    }
    const [items, total] = await Promise.all([
      this.bookings
        .find(filter)
        .sort({ checkIn: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .populate('hotel', 'name city country'),
      this.bookings.countDocuments(filter),
    ]);
    return buildPage(items, total, page);
  }

  /** The refund the user sees BEFORE confirming, on the full total (HTL-21). */
  async refundPreview(user: UserDocument, id: string) {
    const b = await this.findOneFor(user, id);
    if (b.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only Confirmed reservations can be cancelled',
      );
    }
    if (b.checkIn <= new Date()) {
      throw new BadRequestException(
        'Cancellation is only possible before the check-in date',
      );
    }
    const hotel = await this.hotels.findById(b.hotel);
    const days = Math.floor((b.checkIn.getTime() - Date.now()) / 86400000);
    const percent = refundPercentFor(hotel!.cancellationPolicy ?? [], days);
    return {
      booking: b,
      daysBeforeCheckIn: days,
      refundPercent: percent,
      refundAmount: Math.round(b.totalPrice * percent) / 100,
    };
  }

  async cancel(user: UserDocument, id: string) {
    const prev = await this.refundPreview(user, id);
    const b = await this.bookings.findOneAndUpdate(
      { _id: id, status: BookingStatus.CONFIRMED },
      {
        status: BookingStatus.CANCELLED,
        cancelledBy: 'USER',
        refundPercent: prev.refundPercent,
        cancelledAt: new Date(),
      },
      { returnDocument: 'after' },
    );
    if (!b) throw new ConflictException('Reservation already changed');
    await this.release(b._id); // all rooms released for those dates
    if (prev.refundPercent > 0) {
      this.events.emit('booking.refund.requested', {
        type: 'hotel',
        bookingId: b.id,
        percent: prev.refundPercent,
      });
    }
    await this.notifications.notify(
      b.user,
      NotificationType.BOOKING_CANCELLED,
      'Hotel reservation cancelled',
      { bookingId: b.id },
    );
    return {
      id: b.id,
      status: b.status,
      refundPercent: prev.refundPercent,
      refundAmount: prev.refundAmount,
    };
  }

  /** HTL-22: reservations of the moderator's hotel. */
  async listForHotel(user: UserDocument, hotelId: string, page = 1) {
    this.hotelsService.assertManages(user, hotelId);
    const filter = {
      hotel: hotelId,
      status: {
        $in: [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.CANCELLED,
        ],
      },
    };
    const [items, total] = await Promise.all([
      this.bookings
        .find(filter)
        .sort({ checkIn: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .populate('user', 'name email'),
      this.bookings.countDocuments(filter),
    ]);
    return buildPage(
      items.map((b) => ({
        reference: b.reference,
        guest: b.user,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        status: b.status,
        rooms: b.rooms.length,
      })),
      total,
      page,
    );
  }

  /** GEN-11 / HTL-23: Confirmed -> Completed once the check-out date has passed. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async completeFinished() {
    await this.bookings.updateMany(
      { status: BookingStatus.CONFIRMED, checkOut: { $lte: new Date() } },
      { status: BookingStatus.COMPLETED },
    );
  }
>>>>>>> origin/develop
}
