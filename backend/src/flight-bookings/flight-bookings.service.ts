import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { DateTime } from 'luxon';
import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';

import { allowedFrom } from './booking-status.util';
import { BookingRequestDto, PassengerDto, SegmentDto } from './dto/booking.dto';
import {
  CancelledBy,
  FlightBooking,
  FlightBookingDocument,
  PassengerType,
} from './schemas/flight-booking.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { assertOwnership, CurrentUserLike } from '../common/utils/ownership';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Cabin,
  CabinClass,
  Flight,
  FlightDocument,
  FlightStatus,
} from '../flights/schemas/flight.schema';
import { Airline, AirlineDocument } from '../airlines/schemas/airline.schema';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingGroup, ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { refundPercentFor, Tier } from '../airlines/cancellation.util';
import {
  BOOKING_REFUND_REQUESTED,
  BookingRefundRequestedEvent,
} from '../common/events/booking-refund-requested.event';
import { PAGE_SIZE } from '../common/utils/pagination';

import { Logger } from '@nestjs/common';        // add to the existing @nestjs/common import
import { OnEvent } from '@nestjs/event-emitter'; // next to EventEmitter2
import { FLIGHT_CANCELLED, FlightCancelledEvent } from '../common/events/flight-cancelled.event';

const INFANT_FARE_RATE = 0.1; // FLT-12(b): infants pay 10% of the fare and take no seat
const HOLD_MINUTES = 10; // FLT-22: seats are held for 10 minutes while the user pays
const FLIGHT_FIELDS = 'flightNumber departureAirport arrivalAirport departureTimeUtc arrivalTimeUtc';
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FlightBookingsService {
  private readonly logger = new Logger(FlightBookingsService.name);
  constructor(
    @InjectModel(Flight.name) private flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    @InjectModel(FlightBooking.name) private bookingModel: Model<FlightBookingDocument>,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Age in whole years on the given day. */
  private ageOn(dateOfBirth: string, day: Date): number {
    const birth = DateTime.fromISO(dateOfBirth, { zone: 'utc' });
    if (!birth.isValid) throw new BadRequestException('Invalid date of birth');
    const on = DateTime.fromJSDate(day, { zone: 'utc' });
    if (birth > on)
      throw new BadRequestException('Date of birth cannot be after the flight date');
    return Math.floor(on.diff(birth, 'years').years);
  }

  private typeForAge(age: number): PassengerType {
    if (age < 2) return PassengerType.INFANT;
    if (age < 12) return PassengerType.CHILD;
    return PassengerType.ADULT;
  }

  /** FLT-12(b): types match the dates of birth, at least one adult, no more infants than adults. */
  private checkPassengers(passengers: PassengerDto[], departure: Date) {
    for (const p of passengers) {
      const age = this.ageOn(p.dateOfBirth, departure);
      const expected = this.typeForAge(age);
      if (p.type !== expected) {
        throw new BadRequestException(
          `${p.fullName} is ${age} years old on the flight date, so the type must be ${expected}`,
        );
      }
    }
    const count = (t: PassengerType) => passengers.filter((p) => p.type === t).length;
    const adults = count(PassengerType.ADULT);
    const infants = count(PassengerType.INFANT);
    if (adults < 1) throw new BadRequestException('A booking needs at least one adult');
    if (infants > adults) throw new BadRequestException('There cannot be more infants than adults');
    return { adults, children: count(PassengerType.CHILD), infants };
  }

  /** Loads the flight of every segment and checks that it can be booked. */
  private async loadSegments(segments: SegmentDto[]) {
    const loaded: { flight: FlightDocument; cabin: Cabin }[] = [];

    for (const s of segments) {
      const flight = await this.flightModel.findById(s.flightId);
      if (!flight) throw new NotFoundException('Flight not found');

      if (flight.status !== FlightStatus.SCHEDULED || flight.departureTimeUtc <= new Date()) {
        throw new BadRequestException(`Flight ${flight.flightNumber} cannot be booked`);
      }

      // ACC-15: a deactivated airline cannot be booked
      const airline = await this.airlineModel.findById(flight.airline).select('isActive').lean();
      if (!airline?.isActive) {
        throw new BadRequestException(`Flight ${flight.flightNumber} cannot be booked`);
      }

      const cabin = flight.cabins.find((c) => c.cabinClass === s.cabinClass);
      if (!cabin) {
        throw new BadRequestException(`Flight ${flight.flightNumber} has no ${s.cabinClass} cabin`);
      }
      loaded.push({ flight, cabin });
    }

    if (loaded.length === 2) {
      const [out, ret] = loaded;
      if (out.flight.id === ret.flight.id) {
        throw new BadRequestException('The outbound and return flights must be different');
      }
      if (ret.flight.departureTimeUtc <= out.flight.arrivalTimeUtc) {
        throw new BadRequestException('The return flight must depart after the outbound flight arrives');
      }
    }
    return loaded;
  }

  /** FLT-22: takes seats from one cabin in ONE atomic update. Returns false if not enough remain. */
  private async takeSeats(flightId: string, cabinClass: CabinClass, seats: number): Promise<boolean> {
    const result = await this.flightModel.updateOne(
      {
        _id: flightId,
        status: FlightStatus.SCHEDULED,
        cabins: { $elemMatch: { cabinClass, availableSeats: { $gte: seats } } },
      },
      { $inc: { 'cabins.$.availableSeats': -seats } },
    );
    return result.modifiedCount === 1;
  }

  /** Gives seats back to one cabin (failed round trip, expired hold, later: cancellation). */
  private async returnSeats(flightId: string, cabinClass: CabinClass, seats: number): Promise<void> {
    await this.flightModel.updateOne(
      { _id: flightId, 'cabins.cabinClass': cabinClass },
      { $inc: { 'cabins.$.availableSeats': seats } },
    );
  }

  /** Takes seats on every segment. If one fails, gives back what was already taken and answers 409. */
  private async takeSeatsForAll(
    segments: { flightId: string; flightNumber: string; cabinClass: CabinClass }[],
    seats: number,
  ): Promise<void> {
    const taken: typeof segments = [];
    for (const s of segments) {
      const ok = await this.takeSeats(s.flightId, s.cabinClass, seats);
      if (!ok) {
        for (const t of taken) await this.returnSeats(t.flightId, t.cabinClass, seats);
        throw new ConflictException(`Not enough ${s.cabinClass} seats on flight ${s.flightNumber}`);
      }
      taken.push(s);
    }
  }

  /** FLT-19: extra bags per passenger, up to the airline's maximum; returns the total baggage fee. */
  private async baggageFee(
    loaded: { flight: any; cabin: any }[],
    passengers: { fullName: string; type: string; extraBags?: number; extraBagWeightKg?: number }[],
  ): Promise<number> {
    let fee = 0;
    for (const { flight, cabin } of loaded) {
      const airline = await this.airlineModel.findById(flight.airline).select('baggagePolicy').lean();
      const policy = airline?.baggagePolicy;
      for (const p of passengers) {
        const bags = p.extraBags ?? 0;
        if (bags === 0) continue;
        if (p.type === 'INFANT') {
          throw new BadRequestException(`${p.fullName} is an infant and cannot have extra bags`);
        }
        if (!policy) {
          throw new BadRequestException(`Flight ${flight.flightNumber} does not sell extra bags`);
        }
        if (bags > policy.maxExtraBags) {
          throw new BadRequestException(
            `Passengers can bring at most ${policy.maxExtraBags} extra bags on flight ${flight.flightNumber}`,
          );
        }
        if ((p.extraBagWeightKg ?? 0) > cabin.maxBagWeightKg) {
          throw new BadRequestException(
            `Each extra bag on flight ${flight.flightNumber} can weigh at most ${cabin.maxBagWeightKg} kg`,
          );
        }
        fee += bags * policy.pricePerExtraBag;
      }
    }
    return fee;
  }

  /** FLT-19, FLT-21: validates the booking and returns the summary. Reserves nothing. */
  async summarize(dto: BookingRequestDto) {
    const loaded = await this.loadSegments(dto.segments);

    // age is measured on the day of the outbound flight
    const counts = this.checkPassengers(dto.passengers, loaded[0].flight.departureTimeUtc);
    const seats = counts.adults + counts.children; // infants sit on laps

    for (const { flight, cabin } of loaded) {
      if (cabin.availableSeats < seats) {
        throw new ConflictException(`Not enough ${cabin.cabinClass} seats on flight ${flight.flightNumber}`);
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;

    const segments = loaded.map(({ flight, cabin }) => ({
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      departureAirport: flight.departureAirport,
      arrivalAirport: flight.arrivalAirport,
      departureTimeUtc: flight.departureTimeUtc,
      cabinClass: cabin.cabinClass,
      farePerSeat: cabin.price,
      subtotal: round(cabin.price * seats + cabin.price * INFANT_FARE_RATE * counts.infants),
    }));

    const baggageFee = round(await this.baggageFee(loaded, dto.passengers));
    const total = round(segments.reduce((sum, s) => sum + s.subtotal, 0) + baggageFee);

    const passengers = dto.passengers.map((p) => ({
      fullName: p.fullName,
      type: p.type,
      extraBags: p.extraBags ?? 0,
      extraBagWeightKg: p.extraBagWeightKg ?? 0,
    }));

    return { ...counts, seats, passengers, segments, baggageFee, total, currency: 'USD' };
  }

  /** GEN-11: changes the status atomically, only from an allowed previous status. Returns null if the change is not allowed now. */
  private async changeStatus(
    bookingId: Types.ObjectId | string,
    to: BookingStatus,
    extra: Record<string, unknown> = {},
  ) {
    return this.bookingModel.findOneAndUpdate(
      { _id: bookingId, status: { $in: allowedFrom(to) } },
      { $set: { status: to, ...extra } },
      { returnDocument: 'after' },
    );
  }

  /** FLT-22: checks everything, takes the seats atomically and creates a Pending Payment booking held for 10 minutes. */
  async hold(dto: BookingRequestDto, userId: string) {
    const summary = await this.summarize(dto); // all checks and the price, no writes

    await this.takeSeatsForAll(summary.segments, summary.seats); // 409 if someone was faster

    try {
      const booking = await this.bookingModel.create({
        user: userId,
        segments: summary.segments.map((s) => ({
          flight: s.flightId,
          cabinClass: s.cabinClass,
          unitPrice: s.farePerSeat, // price at booking time (later price changes do not affect it)
        })),
        passengers: dto.passengers.map((p) => ({
          fullName: p.fullName,
          dateOfBirth: new Date(p.dateOfBirth),
          passportNumber: p.passportNumber,
          type: p.type,
          extraBags: p.extraBags ?? 0,
          extraBagWeightKg: p.extraBagWeightKg ?? 0,
        })),
        seats: summary.seats,
        totalPrice: summary.total,
        currency: summary.currency,
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      });

      return { bookingId: booking.id, status: booking.status, holdExpiresAt: booking.holdExpiresAt, ...summary };
    } catch (err) {
      // the booking could not be saved: give the seats back so they are not lost
      for (const s of summary.segments) {
        await this.returnSeats(s.flightId, s.cabinClass, summary.seats);
      }
      throw err;
    }
  }

  /** FLT-23, for Member 6 (payments): what the user must pay. Only the owner, only while the hold is active. */
  async getPayable(bookingId: string, userId: string) {
       const booking = assertOwnership<FlightBookingDocument>(
      Types.ObjectId.isValid(bookingId) ? await this.bookingModel.findById(bookingId) : null,
      (b) => b.user,
      { id: userId, role: Role.USER },
      { notFoundMessage: 'Booking not found' },
    );

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException(`This booking is ${booking.status} and cannot be paid`);
    }
    if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) {
      throw new ConflictException('The seat hold has expired. Please start the booking again.');
    }

    return {
      bookingId: booking.id,
      kind: 'FLIGHT' as const,
      amount: booking.totalPrice,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
      description: `Flight booking ${booking.id}`,
    };
  }

  /** FLT-23, for Member 6 (payment webhook): confirms the booking after a successful payment. */
  async markPaid(bookingId: string, paymentId: string) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Booking not found');

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // the seats were taken at hold time: confirming keeps them, and holdExpiresAt is cleared
        const booking = await this.changeStatus(bookingId, BookingStatus.CONFIRMED, {
          reference: this.newReference(),
          paymentId,
          holdExpiresAt: null,
        });

        if (!booking) {
          // the webhook may be sent twice: the same payment on an already confirmed booking is fine
          const existing = await this.bookingModel.findById(bookingId);
          if (existing?.status === BookingStatus.CONFIRMED && existing.paymentId === paymentId) {
            return existing;
          }
          throw new ConflictException('This booking is no longer waiting for payment and cannot be confirmed');
        }

        await this.notifyConfirmed(booking);
        return booking;
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 5) continue; // reference already used: try another one
        throw err;
      }
    }
    throw new ConflictException('Could not generate a unique booking reference');
  }

  /** Unique-looking reference such as FB-7K2Q9X (no 0/O or 1/I to avoid confusion). */
  private newReference(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'FB-';
    for (const b of randomBytes(6)) code += chars[b % chars.length];
    return code;
  }

  /** FLT-23: in-app notification with the booking details (GEN-01). */
  private async notifyConfirmed(booking: FlightBookingDocument) {
    await booking.populate('segments.flight', FLIGHT_FIELDS);
    const trips = booking.segments
      .map((s) => {
        const f = s.flight as any;
        return `${f.flightNumber} ${f.departureAirport} to ${f.arrivalAirport} on ${f.departureTimeUtc.toISOString().slice(0, 10)}`;
      })
      .join(', ');

    await this.notifications.notify(
      booking.user,
      NotificationType.BOOKING_CONFIRMED,
      `Your flight booking ${booking.reference} is confirmed: ${trips}. Total paid: ${booking.totalPrice} ${booking.currency}.`,
      { bookingId: booking.id, reference: booking.reference },
    );
  }

  /** FLT-23 confirmation page (and FLT-25 details): one booking with its flights. Owner or admin only. */

  async findOne(bookingId: string, user: CurrentUserLike) {
    const booking = assertOwnership<FlightBookingDocument>(
      Types.ObjectId.isValid(bookingId) ? await this.bookingModel.findById(bookingId) : null,
      (b) => b.user,
      user,
      { notFoundMessage: 'Booking not found', allowAdmin: true },
    );
    await booking.populate('segments.flight', FLIGHT_FIELDS);
    return booking;
  }

  /** FLT-23: e-ticket PDF for a confirmed booking. */
  async eTicket(bookingId: string, user: CurrentUserLike): Promise<{ fileName: string; pdf: Buffer }> {
    const booking = await this.findOne(bookingId, user);
    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException('An e-ticket is only available for confirmed bookings');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(22).text('E-ticket', { align: 'center' }).moveDown();
    doc.fontSize(12).text(`Booking reference: ${booking.reference}`);
    doc.text(`Status: ${booking.status}`).moveDown();

    doc.fontSize(14).text('Flights').fontSize(12);
    for (const s of booking.segments) {
      const f = s.flight as any;
      doc.text(
        `${f.flightNumber}   ${f.departureAirport} -> ${f.arrivalAirport}   ` +
          `departs ${f.departureTimeUtc.toISOString().replace('T', ' ').slice(0, 16)} UTC   ${s.cabinClass}`,
      );
    }
    doc.moveDown();

    doc.fontSize(14).text('Passengers').fontSize(12);
    for (const p of booking.passengers) {
      const bags = p.extraBags ? `, ${p.extraBags} extra bag(s)` : '';
      doc.text(`${p.fullName} (${p.type}), passport ${p.passportNumber}${bags}`);
    }
    doc.moveDown();

    doc.text(`Total paid: ${booking.totalPrice} ${booking.currency}`);
    doc.end();

    return { fileName: `e-ticket-${booking.reference}.pdf`, pdf: await done };
  }

   /** FLT-25: my bookings for one group (upcoming / past / cancelled), 10 per page. */
  async findMine(userId: string, query: ListBookingsQueryDto) {
    const now = new Date();
    const group = query.group ?? BookingGroup.UPCOMING;
    const page = query.page ?? 1;

    const groupMatch: Record<string, unknown> =
      group === BookingGroup.UPCOMING
        ? { status: BookingStatus.CONFIRMED, 'outbound.departureTimeUtc': { $gt: now } }
        : group === BookingGroup.PAST
          ? {
              $or: [
                { status: BookingStatus.COMPLETED },
                { status: BookingStatus.CONFIRMED, 'outbound.departureTimeUtc': { $lte: now } },
              ],
            }
          : { status: BookingStatus.CANCELLED };

    // upcoming: soonest first; past and cancelled: most recent first
    const sortDir = group === BookingGroup.UPCOMING ? 1 : -1;

    // segments[0] is always the outbound flight
    const [res] = await this.bookingModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(userId),
          status: { $in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.CANCELLED] },
        },
      },
      { $addFields: { outboundId: { $arrayElemAt: ['$segments.flight', 0] } } },
      { $lookup: { from: 'flights', localField: 'outboundId', foreignField: '_id', as: 'outbound' } },
      { $unwind: '$outbound' },
      { $match: groupMatch },
      { $sort: { 'outbound.departureTimeUtc': sortDir, _id: 1 } },
      {
        $facet: {
          ids: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }, { $project: { _id: 1 } }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    const ids: Types.ObjectId[] = res.ids.map((d: { _id: Types.ObjectId }) => d._id);
    const total: number = res.total[0]?.n ?? 0;

    const docs = await this.bookingModel
      .find({ _id: { $in: ids } })
      .populate('segments.flight', FLIGHT_FIELDS);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const items = ids.map((id) => byId.get(id.toString())).filter(Boolean);

    return {
      group,
      items,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** FLT-26: how much would be refunded if the booking were cancelled now. FLT-12(a): outbound tier for the whole booking. */
  private async buildRefund(booking: FlightBookingDocument) {
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(`A ${booking.status} booking cannot be cancelled`);
    }

    const outbound = await this.flightModel
      .findById(booking.segments[0].flight)
      .select('airline departureTimeUtc')
      .lean();
    if (!outbound) throw new NotFoundException('Flight not found');
    if (outbound.departureTimeUtc <= new Date()) {
      throw new ConflictException('The flight has already departed and cannot be cancelled');
    }

    // the policy may be stored as an array of tiers or as { tiers: [...] }
    const airline = await this.airlineModel.findById(outbound.airline).select('cancellationPolicy').lean();
    const raw = (airline as any)?.cancellationPolicy;
    const tiers: Tier[] = Array.isArray(raw) ? raw : (raw?.tiers ?? []);

    const daysRemaining = Math.floor((outbound.departureTimeUtc.getTime() - Date.now()) / DAY_MS);
    const refundPercent = refundPercentFor(tiers, daysRemaining);
    const refundAmount = Math.round(booking.totalPrice * refundPercent) / 100;

    return { daysRemaining, refundPercent, refundAmount };
  }

  /** FLT-26: loads my booking (owner only, not even admins) for cancel and preview. */
  private async loadOwn(bookingId: string, userId: string) {
    return assertOwnership<FlightBookingDocument>(
      Types.ObjectId.isValid(bookingId) ? await this.bookingModel.findById(bookingId) : null,
      (b) => b.user,
      { id: userId, role: Role.USER },
      { notFoundMessage: 'Booking not found' },
    );
  }

  /** FLT-26: refund shown to the user BEFORE they confirm the cancellation. */
  async refundPreview(bookingId: string, userId: string) {
    const booking = await this.loadOwn(bookingId, userId);
    const refund = await this.buildRefund(booking);
    return {
      bookingId: booking.id,
      reference: booking.reference,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      ...refund,
    };
  }

  /** FLT-26: the user cancels their own booking. */
  async cancel(bookingId: string, userId: string) {
    const booking = await this.loadOwn(bookingId, userId);
    return this.applyCancellation(booking.id, CancelledBy.USER);
  }

  /**
   * FLT-26 / PAY-03: THE cancellation. Refund by tier, status change, seats back, refund event, notification.
   * Member 6 can call this too. Safe against double calls: changeStatus only works from CONFIRMED.
   */
  async applyCancellation(bookingId: string, cancelledBy: CancelledBy = CancelledBy.USER) {
    const current = await this.bookingModel.findById(bookingId);
    if (!current) throw new NotFoundException('Booking not found');

    const refund = await this.buildRefund(current); // 409 if not CONFIRMED or already departed

    const booking = await this.changeStatus(bookingId, BookingStatus.CANCELLED, {
      cancelledBy,
      refundPercent: refund.refundPercent,
      cancelledAt: new Date(),
    });
    if (!booking) throw new ConflictException('This booking can no longer be cancelled');

    for (const s of booking.segments) {
      await this.returnSeats(s.flight.toString(), s.cabinClass, booking.seats);
    }

    if (booking.paymentId && refund.refundAmount > 0) {
      this.events.emit(
        BOOKING_REFUND_REQUESTED,
        new BookingRefundRequestedEvent(booking.id, booking.paymentId, refund.refundAmount, booking.currency),
      );
    }

    await this.notifications.notify(
      booking.user,
      NotificationType.BOOKING_CANCELLED,
      `Your flight booking ${booking.reference} was cancelled. Refund: ${refund.refundAmount} ${booking.currency} (${refund.refundPercent}%).`,
      { bookingId: booking.id, reference: booking.reference },
    );

    return {
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      refundPercent: refund.refundPercent,
      refundAmount: refund.refundAmount,
      currency: booking.currency,
    };
  }

  /** GEN-11: every hour, CONFIRMED bookings whose LAST flight has departed become COMPLETED. */
  @Cron(CronExpression.EVERY_HOUR)
  async completeFinished(): Promise<void> {
    const due = await this.bookingModel.aggregate([
      { $match: { status: BookingStatus.CONFIRMED } },
      { $lookup: { from: 'flights', localField: 'segments.flight', foreignField: '_id', as: 'f' } },
      { $addFields: { lastDeparture: { $max: '$f.departureTimeUtc' } } },
      { $match: { lastDeparture: { $lte: new Date() } } },
      { $project: { _id: 1 } },
    ]);
    for (const { _id } of due) await this.changeStatus(_id, BookingStatus.COMPLETED);
  }

  /** FLT-06: a flight was cancelled. Confirmed bookings get a 100% refund, pending holds are released. */
  @OnEvent(FLIGHT_CANCELLED, { suppressErrors: false })
  async onFlightCancelled(event: FlightCancelledEvent) {
    const bookings = await this.bookingModel.find({
      'segments.flight': event.flightId,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
    });

    let cancelledBookings = 0;
    let expiredHolds = 0;
    const when = event.departureTimeUtc.toISOString().slice(0, 10);

    for (const b of bookings) {
      try {
        // 1) a pending hold is simply released
        if (b.status === BookingStatus.PENDING_PAYMENT) {
          const expired = await this.changeStatus(b._id, BookingStatus.EXPIRED);
          if (expired) {
            await this.returnOtherSegments(expired, event.flightId);
            await this.notifications.notify(
              expired.user,
              NotificationType.FLIGHT_CANCELLED,
              `Flight ${event.flightNumber} (${event.route}, ${when}) was cancelled, so your seat hold was released.`,
              { bookingId: expired.id },
            );
            expiredHolds++;
            continue;
          }
          // not pending any more: it may have just been paid, so try to cancel it below
        }

        // 2) a confirmed booking is cancelled with a full refund (not the airline tiers)
        const booking = await this.changeStatus(b._id, BookingStatus.CANCELLED, {
          cancelledBy: CancelledBy.AIRLINE,
          refundPercent: 100,
          cancelledAt: new Date(),
        });
        if (!booking) continue; // already changed elsewhere

        await this.returnOtherSegments(booking, event.flightId);

        if (booking.paymentId && booking.totalPrice > 0) {
          this.events.emit(
            BOOKING_REFUND_REQUESTED,
            new BookingRefundRequestedEvent(booking.id, booking.paymentId, booking.totalPrice, booking.currency),
          );
        }

        await this.notifications.notify(
          booking.user,
          NotificationType.FLIGHT_CANCELLED,
          `Flight ${event.flightNumber} (${event.route}, ${when}) was cancelled by the airline. Your booking ${booking.reference} is cancelled and you will get a full refund of ${booking.totalPrice} ${booking.currency}.`,
          { bookingId: booking.id, reference: booking.reference },
        );
        cancelledBookings++;
      } catch (err) {
        // one failing booking must not stop the others
        this.logger.error(`Could not process booking ${b.id} for cancelled flight ${event.flightId}`, err as Error);
      }
    }

    return { cancelledBookings, expiredHolds };
  }

  /** FLT-06: a round trip also holds seats on the OTHER flight. Return those (the cancelled flight needs no seats back). */
  private async returnOtherSegments(booking: FlightBookingDocument, cancelledFlightId: string) {
    for (const s of booking.segments) {
      if (s.flight.toString() === cancelledFlightId) continue;
      await this.returnSeats(s.flight.toString(), s.cabinClass, booking.seats);
    }
  }

  /** FLT-22, GEN-11: every minute, expired holds become EXPIRED and their seats are released. */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds(): Promise<void> {
    const now = new Date();
    const due = await this.bookingModel
      .find({ status: BookingStatus.PENDING_PAYMENT, holdExpiresAt: { $lte: now } })
      .select('_id')
      .lean();

    for (const { _id } of due) {
      // atomic: only expire it if it is STILL pending (a payment may have just confirmed it)
      const booking = await this.changeStatus(_id, BookingStatus.EXPIRED);
      if (!booking) continue; // already confirmed or expired elsewhere

      for (const s of booking.segments) {
        await this.returnSeats(s.flight.toString(), s.cabinClass, booking.seats);
      }
    }
  }
}