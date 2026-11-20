
import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { DateTime } from 'luxon';
import { randomBytes } from 'crypto';
import PDFDocument from 'pdfkit';

import {
  CancelledBy, FlightBooking, FlightBookingDocument, FlightChangeStatus, PassengerType,
} from './schemas/flight-booking.schema';
import { allowedFrom } from './booking-status.util';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { assertOwnership, CurrentUserLike } from '../common/utils/ownership';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Cabin, CabinClass, Flight, FlightDocument, FlightStatus,
} from '../flights/schemas/flight.schema';
import { Airline, AirlineDocument } from '../airlines/schemas/airline.schema';
import { BookingGroup, ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { refundPercentFor, Tier } from '../airlines/cancellation.util';
import {
  BOOKING_REFUND_REQUESTED, BookingRefundRequestedEvent,
} from '../common/events/booking-refund-requested.event';
import { PAGE_SIZE } from '../common/utils/pagination';
import { FLIGHT_CANCELLED, FlightCancelledEvent } from '../common/events/flight-cancelled.event';
import {
  BookingRequestDto, ChangeFlightBookingDto, PassengerDto, SegmentDto,
} from './dto/booking.dto';
import { SeatClaim, SeatClaimDocument } from './schemas/seat-claim.schema';
import { isValidSeat, normalizeSeat } from './seat-layout.util';
import { SelectSeatsDto } from './dto/select-seats.dto';

const INFANT_FARE_RATE = 0.1;
const HOLD_MINUTES = 10;
const FLIGHT_FIELDS = 'flightNumber departureAirport arrivalAirport departureTimeUtc arrivalTimeUtc';
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FlightBookingsService {
  private readonly logger = new Logger(FlightBookingsService.name);

  constructor(
    @InjectModel(Flight.name) private flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    @InjectModel(FlightBooking.name) private bookingModel: Model<FlightBookingDocument>,
    @InjectModel(SeatClaim.name) private seatClaimModel: Model<SeatClaimDocument>,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  private ageOn(dateOfBirth: string, day: Date): number {
    const birth = DateTime.fromISO(dateOfBirth, { zone: 'utc' });
    if (!birth.isValid) throw new BadRequestException('Invalid date of birth');
    const on = DateTime.fromJSDate(day, { zone: 'utc' });
    if (birth > on) throw new BadRequestException('Date of birth cannot be after the flight date');
    return Math.floor(on.diff(birth, 'years').years);
  }

  private typeForAge(age: number): PassengerType {
    if (age < 2) return PassengerType.INFANT;
    if (age < 12) return PassengerType.CHILD;
    return PassengerType.ADULT;
  }

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

    const count = (type: PassengerType) => passengers.filter((p) => p.type === type).length;
    const adults = count(PassengerType.ADULT);
    const infants = count(PassengerType.INFANT);

    if (!adults) throw new BadRequestException('A booking needs at least one adult');
    if (infants > adults) throw new BadRequestException('There cannot be more infants than adults');

    return { adults, children: count(PassengerType.CHILD), infants };
  }

  private async loadSegments(segments: SegmentDto[]) {
    const loaded: { flight: FlightDocument; cabin: Cabin }[] = [];

    for (const segment of segments) {
      const flight = await this.flightModel.findById(segment.flightId);
      if (!flight) throw new NotFoundException('Flight not found');
      if (flight.status !== FlightStatus.SCHEDULED || flight.departureTimeUtc <= new Date()) {
        throw new BadRequestException(`Flight ${flight.flightNumber} cannot be booked`);
      }

      const airline = await this.airlineModel.findById(flight.airline).select('isActive').lean();
      if (!airline?.isActive) throw new BadRequestException(`Flight ${flight.flightNumber} cannot be booked`);

      const cabin = flight.cabins.find((c) => c.cabinClass === segment.cabinClass);
      if (!cabin) {
        throw new BadRequestException(`Flight ${flight.flightNumber} has no ${segment.cabinClass} cabin`);
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

  private async returnSeats(flightId: string, cabinClass: CabinClass, seats: number): Promise<void> {
    await this.flightModel.updateOne(
      { _id: flightId, 'cabins.cabinClass': cabinClass },
      { $inc: { 'cabins.$.availableSeats': seats } },
    );
  }

  private async takeSeatsForAll(
    segments: { flightId: string; flightNumber: string; cabinClass: CabinClass }[],
    seats: number,
  ): Promise<void> {
    const taken: typeof segments = [];

    for (const segment of segments) {
      if (!await this.takeSeats(segment.flightId, segment.cabinClass, seats)) {
        for (const item of taken) {
          await this.returnSeats(item.flightId, item.cabinClass, seats);
        }
        throw new ConflictException(`Not enough ${segment.cabinClass} seats on flight ${segment.flightNumber}`);
      }
      taken.push(segment);
    }
  }

  private async baggageFee(
    loaded: { flight: any; cabin: any }[],
    passengers: { fullName: string; type: string; extraBags?: number; extraBagWeightKg?: number }[],
  ): Promise<number> {
    let fee = 0;

    for (const { flight, cabin } of loaded) {
      const airline = await this.airlineModel.findById(flight.airline).select('baggagePolicy').lean();
      const policy = airline?.baggagePolicy;

      for (const passenger of passengers) {
        const bags = passenger.extraBags ?? 0;
        if (!bags) continue;
        if (passenger.type === 'INFANT') {
          throw new BadRequestException(`${passenger.fullName} is an infant and cannot have extra bags`);
        }
        if (!policy) throw new BadRequestException(`Flight ${flight.flightNumber} does not sell extra bags`);
        if (bags > policy.maxExtraBags) {
          throw new BadRequestException(
            `Passengers can bring at most ${policy.maxExtraBags} extra bags on flight ${flight.flightNumber}`,
          );
        }
        if ((passenger.extraBagWeightKg ?? 0) > cabin.maxBagWeightKg) {
          throw new BadRequestException(
            `Each extra bag on flight ${flight.flightNumber} can weigh at most ${cabin.maxBagWeightKg} kg`,
          );
        }
        fee += bags * policy.pricePerExtraBag;
      }
    }
    return fee;
  }

  async summarize(dto: BookingRequestDto) {
    const loaded = await this.loadSegments(dto.segments);
    const counts = this.checkPassengers(dto.passengers, loaded[0].flight.departureTimeUtc);
    const seats = counts.adults + counts.children;

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
    const total = round(segments.reduce((sum, segment) => sum + segment.subtotal, 0) + baggageFee);
    const passengers = dto.passengers.map((p) => ({
      fullName: p.fullName,
      type: p.type,
      extraBags: p.extraBags ?? 0,
      extraBagWeightKg: p.extraBagWeightKg ?? 0,
    }));

    return { ...counts, seats, passengers, segments, baggageFee, total, currency: 'USD' };
  }

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

  /** FLT-28: free the seats of a booking, on one flight or on all of its flights. */
  private async releaseSeats(bookingId: Types.ObjectId | string, flightId?: Types.ObjectId | string) {
    await this.seatClaimModel.deleteMany({
      booking: new Types.ObjectId(String(bookingId)),
      ...(flightId ? { flight: new Types.ObjectId(String(flightId)) } : {}),
    });
  }

  async hold(dto: BookingRequestDto, userId: string) {
    const summary = await this.summarize(dto);
    await this.takeSeatsForAll(summary.segments, summary.seats);

    try {
      const booking = await this.bookingModel.create({
        user: userId,
        segments: summary.segments.map((s) => ({
          flight: s.flightId,
          cabinClass: s.cabinClass,
          unitPrice: s.farePerSeat,
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

      return {
        bookingId: booking.id,
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt,
        ...summary,
      };
    } catch (err) {
      for (const segment of summary.segments) {
        await this.returnSeats(segment.flightId, segment.cabinClass, summary.seats);
      }
      throw err;
    }
  }

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

  async markPaid(bookingId: string, paymentId: string) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Booking not found');

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const booking = await this.changeStatus(bookingId, BookingStatus.CONFIRMED, {
          reference: this.newReference(),
          paymentId,
          holdExpiresAt: null,
        });

        if (!booking) {
          const existing = await this.bookingModel.findById(bookingId);
          if (existing?.status === BookingStatus.CONFIRMED && existing.paymentId === paymentId) return existing;
          throw new ConflictException('This booking is no longer waiting for payment and cannot be confirmed');
        }

        await this.notifyConfirmed(booking);
        return booking;
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 5) continue;
        throw err;
      }
    }
    throw new ConflictException('Could not generate a unique booking reference');
  }

  private newReference(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'FB-';
    for (const b of randomBytes(6)) code += chars[b % chars.length];
    return code;
  }

  private async notifyConfirmed(booking: FlightBookingDocument) {
    await booking.populate('segments.flight', FLIGHT_FIELDS);
    const trips = booking.segments.map((s) => {
      const flight = s.flight as any;
      return `${flight.flightNumber} ${flight.departureAirport} to ${flight.arrivalAirport} on ${flight.departureTimeUtc.toISOString().slice(0, 10)}`;
    }).join(', ');

    await this.notifications.notify(
      booking.user,
      NotificationType.BOOKING_CONFIRMED,
      `Your flight booking ${booking.reference} is confirmed: ${trips}. Total paid: ${booking.totalPrice} ${booking.currency}.`,
      { bookingId: booking.id, reference: booking.reference },
    );
  }

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

  async eTicket(bookingId: string, user: CurrentUserLike): Promise<{ fileName: string; pdf: Buffer }> {
    const booking = await this.findOne(bookingId, user);
    if (![BookingStatus.CONFIRMED, BookingStatus.COMPLETED].includes(booking.status)) {
      throw new ConflictException('An e-ticket is only available for confirmed bookings');
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    doc.fontSize(22).text('E-ticket', { align: 'center' }).moveDown();
    doc.fontSize(12).text(`Booking reference: ${booking.reference}`);
    doc.text(`Status: ${booking.status}`).moveDown();
    doc.fontSize(14).text('Flights').fontSize(12);

    for (const segment of booking.segments) {
      const flight = segment.flight as any;
      doc.text(
        `${flight.flightNumber}   ${flight.departureAirport} -> ${flight.arrivalAirport}   ` +
        `departs ${flight.departureTimeUtc.toISOString().replace('T', ' ').slice(0, 16)} UTC   ${segment.cabinClass}`,
      );
    }

    doc.moveDown().fontSize(14).text('Passengers').fontSize(12);
    for (const passenger of booking.passengers) {
      const bags = passenger.extraBags ? `, ${passenger.extraBags} extra bag(s)` : '';
      doc.text(`${passenger.fullName} (${passenger.type}), passport ${passenger.passportNumber}${bags}`);
    }

    const claims = await this.seatClaimModel.find({ booking: booking._id }).lean();
    if (claims.length) {
      doc.moveDown().fontSize(14).text('Seats').fontSize(12);
      for (const segment of booking.segments) {
        const flight = segment.flight as any;
        for (const c of claims.filter((x) => x.flight.toString() === flight._id.toString())) {
          doc.text(`${flight.flightNumber}: ${booking.passengers[c.passengerIndex]?.fullName ?? 'Passenger'} - seat ${c.seatNumber}`);
        }
      }
    }

    doc.moveDown().text(`Total paid: ${booking.totalPrice} ${booking.currency}`);
    doc.end();
    return { fileName: `e-ticket-${booking.reference}.pdf`, pdf: await done };
  }

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

    const sortDir = group === BookingGroup.UPCOMING ? 1 : -1;
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
    const docs = await this.bookingModel.find({ _id: { $in: ids } }).populate('segments.flight', FLIGHT_FIELDS);
    const byId = new Map(docs.map((d) => [d.id, d]));
    const items = ids.map((id) => byId.get(id.toString())).filter(Boolean);

    return {
      group, items, page, pageSize: PAGE_SIZE, total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  private async buildRefund(booking: FlightBookingDocument) {
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(`A ${booking.status} booking cannot be cancelled`);
    }

    const outbound = await this.flightModel.findById(booking.segments[0].flight)
      .select('airline departureTimeUtc').lean();
    if (!outbound) throw new NotFoundException('Flight not found');
    if (outbound.departureTimeUtc <= new Date()) {
      throw new ConflictException('The flight has already departed and cannot be cancelled');
    }

    const airline = await this.airlineModel.findById(outbound.airline).select('cancellationPolicy').lean();
    const raw = (airline as any)?.cancellationPolicy;
    const tiers: Tier[] = Array.isArray(raw) ? raw : (raw?.tiers ?? []);
    const daysRemaining = Math.floor((outbound.departureTimeUtc.getTime() - Date.now()) / DAY_MS);
    const refundPercent = refundPercentFor(tiers, daysRemaining);
    const refundAmount = Math.round(booking.totalPrice * refundPercent) / 100;

    return { daysRemaining, refundPercent, refundAmount };
  }

  private async loadOwn(bookingId: string, userId: string) {
    return assertOwnership<FlightBookingDocument>(
      Types.ObjectId.isValid(bookingId) ? await this.bookingModel.findById(bookingId) : null,
      (b) => b.user,
      { id: userId, role: Role.USER },
      { notFoundMessage: 'Booking not found' },
    );
  }

  async previewChange(bookingId: string, userId: string, dto: ChangeFlightBookingDto) {
    const booking = await this.loadOwn(bookingId, userId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException('Only confirmed bookings can be changed');
    }
    if (booking.pendingChange) throw new ConflictException('This booking already has a pending change');

    const oldFlights = await Promise.all(booking.segments.map((s) => this.flightModel.findById(s.flight)));
    if (oldFlights.some((flight) => !flight)) throw new NotFoundException('An existing booking flight was not found');
    if (oldFlights.some((flight) => flight!.departureTimeUtc <= new Date())) {
      throw new ConflictException('A booking cannot be changed after a flight has departed');
    }
    if (dto.segments.length !== booking.segments.length) {
      throw new BadRequestException('The number of flight segments cannot be changed');
    }

    const loaded = await this.loadSegments(dto.segments);
    for (let i = 0; i < loaded.length; i++) {
      const oldFlight = oldFlights[i]!;
      const newFlight = loaded[i].flight;

      if (
        oldFlight.departureAirport !== newFlight.departureAirport ||
        oldFlight.arrivalAirport !== newFlight.arrivalAirport
      ) throw new BadRequestException('A replacement flight must have the same route');

      if (booking.segments[i].cabinClass !== loaded[i].cabin.cabinClass) {
        throw new BadRequestException('The cabin class cannot be changed');
      }
      if (oldFlight.id === newFlight.id) {
        throw new BadRequestException('The replacement flight must be different');
      }
    }

    const passengers = booking.passengers.map((p) => ({
      fullName: p.fullName,
      dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
      passportNumber: p.passportNumber,
      type: p.type,
      extraBags: p.extraBags,
      extraBagWeightKg: p.extraBagWeightKg,
    }));

    const counts = this.checkPassengers(passengers, loaded[0].flight.departureTimeUtc);
    const seats = counts.adults + counts.children;
    if (seats !== booking.seats) {
      throw new ConflictException('The passenger seat count does not match the existing booking');
    }

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

    const baggageFee = round(await this.baggageFee(loaded, passengers));
    const total = round(segments.reduce((sum, s) => sum + s.subtotal, 0) + baggageFee);
    return {
      bookingId: booking.id,
      reference: booking.reference,
      currentTotal: booking.totalPrice,
      newTotal: total,
      fareDifference: round(total - booking.totalPrice),
      currency: booking.currency,
      seats,
      segments,
      baggageFee,
    };
  }

  async requestChange(bookingId: string, userId: string, dto: ChangeFlightBookingDto) {
    const preview = await this.previewChange(bookingId, userId, dto);
    const booking = await this.loadOwn(bookingId, userId);

    if (booking.status !== BookingStatus.CONFIRMED || booking.pendingChange) {
      throw new ConflictException('The booking can no longer be changed');
    }

    const replacementSegments = preview.segments.map((s) => ({
      flightId: s.flightId,
      flightNumber: s.flightNumber,
      cabinClass: s.cabinClass,
    }));

    await this.takeSeatsForAll(replacementSegments, preview.seats);

    const newSegments = preview.segments.map((s) => ({
      flight: new Types.ObjectId(s.flightId),
      cabinClass: s.cabinClass,
      unitPrice: s.farePerSeat,
    }));

    const changeId = randomBytes(16).toString('hex');
    const fareDifference = preview.fareDifference;
    let itineraryApplied = false;

    try {
      if (fareDifference === 0) {
        const updated = await this.bookingModel.findOneAndUpdate(
          {
            _id: booking._id,
            user: new Types.ObjectId(userId),
            status: BookingStatus.CONFIRMED,
            pendingChange: null,
          },
          { $set: { segments: newSegments, totalPrice: preview.newTotal } },
          { new: true },
        );

        if (!updated) {
          throw new ConflictException('The booking has changed or already has a pending change');
        }

        itineraryApplied = true;
        for (const old of booking.segments) {
          await this.returnSeats(old.flight.toString(), old.cabinClass, booking.seats);
        }

        await this.notifications.notify(
          booking.user,
          NotificationType.FLIGHT_CHANGE_APPLIED,
          `Your flight has been changed at no extra cost. Your booking ${booking.reference} is updated.`,
          { bookingId: booking.id, changeId },
        );

        return {
          changeId, status: 'COMPLETED', paymentRequired: false, refundDue: 0, ...preview,
        };
      }

      const pendingChange = {
        changeId,
        segments: newSegments,
        totalPrice: preview.newTotal,
        fareDifference,
        status: fareDifference > 0
          ? FlightChangeStatus.PENDING_PAYMENT
          : FlightChangeStatus.PENDING_REFUND,
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
      };

      const updated = await this.bookingModel.findOneAndUpdate(
        {
          _id: booking._id,
          user: new Types.ObjectId(userId),
          status: BookingStatus.CONFIRMED,
          pendingChange: null,
        },
        { $set: { pendingChange } },
        { new: true },
      );

      if (!updated) {
        throw new ConflictException('The booking has changed or already has a pending change');
      }

      // FLT-27: When the new fare is lower, apply the booking change immediately and
      // trigger the refund. The PENDING_REFUND state is resolved right away; no
      // second client round-trip is needed.
      if (fareDifference < 0) {
        itineraryApplied = true;

        // Apply the booking change (swap segments, clear pendingChange).
        await this.applyPendingChange(bookingId, changeId, FlightChangeStatus.PENDING_REFUND);

        // Emit the refund event that RefundsService handles via 'booking.refund.requested'.
        // The handler will find the original INITIAL_BOOKING payment and issue a partial
        // Stripe refund for the absolute fare difference.
        this.events.emit(BOOKING_REFUND_REQUESTED, {
          type: 'flight',
          bookingId: booking._id.toString(),
          amount: Math.round(Math.abs(fareDifference) * 100) / 100,
        });

        await this.notifications.notify(
          booking.user,
          NotificationType.FLIGHT_CHANGE_APPLIED,
          `Your flight has been changed. A refund of ${Math.abs(fareDifference)} ${booking.currency} will be processed shortly.`,
          { bookingId: booking.id, changeId, refundAmount: Math.abs(fareDifference) },
        );

        return {
          changeId,
          status: 'COMPLETED',
          paymentRequired: false,
          refundDue: Math.abs(fareDifference),
          ...preview,
        };
      }

      return {
        changeId,
        status: pendingChange.status,
        expiresAt: pendingChange.expiresAt,
        paymentRequired: true,
        refundDue: 0,
        ...preview,
      };
    } catch (err) {
      if (!itineraryApplied) {
        const current = await this.bookingModel.findById(booking._id).select('pendingChange');
        if (current?.pendingChange?.changeId !== changeId) {
          for (const segment of replacementSegments) {
            await this.returnSeats(segment.flightId, segment.cabinClass, preview.seats);
          }
        }
      }
      throw err;
    }
  }

  private async applyPendingChange(
    bookingId: string,
    changeId: string,
    expectedStatus: FlightChangeStatus,
  ) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Booking not found');

    const booking = await this.bookingModel.findOne({
      _id: bookingId,
      status: BookingStatus.CONFIRMED,
      'pendingChange.changeId': changeId,
      'pendingChange.status': expectedStatus,
    });

    if (!booking?.pendingChange) {
      throw new ConflictException('The pending flight change was not found or is no longer active');
    }

    if (!booking.pendingChange.expiresAt || booking.pendingChange.expiresAt <= new Date()) {
      throw new ConflictException('The pending flight change has expired');
    }

    const oldSegments = booking.segments.map((s) => ({
      flight: s.flight.toString(),
      cabinClass: s.cabinClass,
    }));
    const pending = booking.pendingChange;

    const updated = await this.bookingModel.findOneAndUpdate(
      {
        _id: booking._id,
        status: BookingStatus.CONFIRMED,
        'pendingChange.changeId': changeId,
        'pendingChange.status': expectedStatus,
      },
      {
        $set: { segments: pending.segments, totalPrice: pending.totalPrice },
        $unset: { pendingChange: 1 },
      },
      { new: true },
    );

    if (!updated) {
      throw new ConflictException('The booking changed before the flight change could be applied');
    }

    for (const segment of oldSegments) {
      await this.returnSeats(segment.flight, segment.cabinClass, booking.seats);
    }

    return {
      bookingId: updated.id,
      changeId,
      status: 'COMPLETED',
      totalPrice: updated.totalPrice,
      currency: updated.currency,
    };
  }

  async completeChangePayment(bookingId: string, changeId: string) {
    return this.applyPendingChange(bookingId, changeId, FlightChangeStatus.PENDING_PAYMENT);
  }

  async completeChangeRefund(bookingId: string, changeId: string) {
    return this.applyPendingChange(bookingId, changeId, FlightChangeStatus.PENDING_REFUND);
  }

  async failPendingChange(bookingId: string, changeId: string) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Booking not found');

    const current = await this.bookingModel.findOne({
      _id: bookingId,
      status: BookingStatus.CONFIRMED,
      'pendingChange.changeId': changeId,
    });
    if (!current?.pendingChange) {
      throw new ConflictException('The pending flight change was not found or is no longer active');
    }

    const replacementSegments = current.pendingChange.segments.map((s) => ({
      flightId: s.flight.toString(),
      cabinClass: s.cabinClass,
    }));

    const updated = await this.bookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: BookingStatus.CONFIRMED,
        'pendingChange.changeId': changeId,
      },
      { $unset: { pendingChange: 1 } },
      { new: true },
    );

    if (!updated) throw new ConflictException('The pending flight change is no longer active');

    for (const segment of replacementSegments) {
      await this.returnSeats(segment.flightId, segment.cabinClass, updated.seats);
    }

    return { bookingId: updated.id, changeId, status: 'FAILED' };
  }

  async refundPreview(bookingId: string, userId: string) {
    const booking = await this.loadOwn(bookingId, userId);
    return {
      bookingId: booking.id,
      reference: booking.reference,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      ...await this.buildRefund(booking),
    };
  }

  async cancel(bookingId: string, userId: string) {
    const booking = await this.loadOwn(bookingId, userId);
    return this.applyCancellation(booking.id, CancelledBy.USER);
  }

  async applyCancellation(bookingId: string, cancelledBy: CancelledBy = CancelledBy.USER) {
    const current = await this.bookingModel.findById(bookingId);
    if (!current) throw new NotFoundException('Booking not found');

    const refund = await this.buildRefund(current);
    const booking = await this.changeStatus(bookingId, BookingStatus.CANCELLED, {
      cancelledBy,
      refundPercent: refund.refundPercent,
      cancelledAt: new Date(),
    });
    if (!booking) throw new ConflictException('This booking can no longer be cancelled');

    for (const segment of booking.segments) {
      await this.returnSeats(segment.flight.toString(), segment.cabinClass, booking.seats);
    }

    if (booking.paymentId && refund.refundAmount > 0) {
      this.events.emit(
        BOOKING_REFUND_REQUESTED,
        new BookingRefundRequestedEvent(
          booking.id, booking.paymentId, refund.refundAmount, booking.currency,
        ),
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

  @OnEvent(FLIGHT_CANCELLED, { suppressErrors: false })
  async onFlightCancelled(event: FlightCancelledEvent) {
    const bookings = await this.bookingModel.find({
      'segments.flight': event.flightId,
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
    });

    let cancelledBookings = 0;
    let expiredHolds = 0;
    const when = event.departureTimeUtc.toISOString().slice(0, 10);

    for (const booking of bookings) {
      try {
        if (booking.status === BookingStatus.PENDING_PAYMENT) {
          const expired = await this.changeStatus(booking._id, BookingStatus.EXPIRED);
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
        }

        const cancelled = await this.changeStatus(booking._id, BookingStatus.CANCELLED, {
          cancelledBy: CancelledBy.AIRLINE,
          refundPercent: 100,
          cancelledAt: new Date(),
        });
        if (!cancelled) continue;

        await this.returnOtherSegments(cancelled, event.flightId);
        if (cancelled.paymentId && cancelled.totalPrice > 0) {
          this.events.emit(
            BOOKING_REFUND_REQUESTED,
            new BookingRefundRequestedEvent(
              cancelled.id, cancelled.paymentId, cancelled.totalPrice, cancelled.currency,
            ),
          );
        }

        await this.notifications.notify(
          cancelled.user,
          NotificationType.FLIGHT_CANCELLED,
          `Flight ${event.flightNumber} (${event.route}, ${when}) was cancelled by the airline. Your booking ${cancelled.reference} is cancelled and you will get a full refund of ${cancelled.totalPrice} ${cancelled.currency}.`,
          { bookingId: cancelled.id, reference: cancelled.reference },
        );
        cancelledBookings++;
      } catch (err) {
        this.logger.error(
          `Could not process booking ${booking.id} for cancelled flight ${event.flightId}`,
          err as Error,
        );
      }
    }

    return { cancelledBookings, expiredHolds };
  }

  private async returnOtherSegments(booking: FlightBookingDocument, cancelledFlightId: string) {
    for (const segment of booking.segments) {
      if (segment.flight.toString() !== cancelledFlightId) {
        await this.returnSeats(segment.flight.toString(), segment.cabinClass, booking.seats);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireHolds(): Promise<void> {
    const due = await this.bookingModel.find({
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: { $lte: new Date() },
    }).select('_id').lean();

    for (const { _id } of due) {
      const booking = await this.changeStatus(_id, BookingStatus.EXPIRED);
      if (!booking) continue;

      for (const segment of booking.segments) {
        await this.returnSeats(segment.flight.toString(), segment.cabinClass, booking.seats);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expirePendingChanges(): Promise<void> {
    const due = await this.bookingModel.find({
      status: BookingStatus.CONFIRMED,
      'pendingChange.expiresAt': { $lte: new Date() },
    }).select('_id pendingChange.changeId').lean();

    for (const booking of due) {
      const changeId = booking.pendingChange?.changeId;
      if (!changeId) continue;

      try {
        await this.failPendingChange(booking._id.toString(), changeId);
      } catch (err) {
        this.logger.warn(
          `Could not expire pending change ${changeId} for booking ${booking._id}: ${err}`,
        );
      }
    }
  }

    // ---------------- FLT-28: seat selection ----------------
  async selectSeats(bookingId: string, userId: string, dto: SelectSeatsDto) {
    const booking = await this.loadOwn(bookingId, userId);
    const now = new Date();

    const holdValid =
      booking.status === BookingStatus.PENDING_PAYMENT && !!booking.holdExpiresAt && booking.holdExpiresAt > now;
    if (!holdValid && booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(`Seats cannot be chosen on a ${booking.status} booking`);
    }
    if (booking.pendingChange) {
      throw new ConflictException('Seats cannot be chosen while a flight change is pending');
    }

    const segment = booking.segments.find((s) => s.flight.toString() === dto.flightId);
    if (!segment) throw new BadRequestException('That flight is not part of this booking');

    const flight = await this.flightModel.findById(dto.flightId).select('flightNumber status departureTimeUtc cabins');
    if (!flight) throw new NotFoundException('Flight not found');
    if (flight.status !== FlightStatus.SCHEDULED || flight.departureTimeUtc <= now) {
      throw new ConflictException(`Seats cannot be chosen on flight ${flight.flightNumber} any more`);
    }
    const cabin = flight.cabins.find((c) => c.cabinClass === segment.cabinClass);
    if (!cabin) throw new NotFoundException(`Flight ${flight.flightNumber} has no ${segment.cabinClass} cabin`);

    const assignments = dto.assignments.map((a) => ({ ...a, seatNumber: normalizeSeat(a.seatNumber) }));
    const passengersSeen = new Set<number>();
    const seatsSeen = new Set<string>();
    for (const a of assignments) {
      const passenger = booking.passengers[a.passengerIndex];
      if (!passenger) throw new BadRequestException(`There is no passenger number ${a.passengerIndex}`);
      if (passenger.type === PassengerType.INFANT) {
        throw new BadRequestException(`${passenger.fullName} is an infant and does not get a seat`);
      }
      if (!isValidSeat(segment.cabinClass, cabin.totalSeats, a.seatNumber)) {
        throw new BadRequestException(`Seat ${a.seatNumber} does not exist in the ${segment.cabinClass} cabin`);
      }
      if (passengersSeen.has(a.passengerIndex)) {
        throw new BadRequestException(`Passenger ${a.passengerIndex} appears twice`);
      }
      if (seatsSeen.has(a.seatNumber)) {
        throw new BadRequestException(`Seat ${a.seatNumber} was chosen for two passengers`);
      }
      passengersSeen.add(a.passengerIndex);
      seatsSeen.add(a.seatNumber);
    }

    const bookingObjectId = booking._id as Types.ObjectId;
    const flightObjectId = new Types.ObjectId(dto.flightId);
    const previous: { passengerIndex: number; seatNumber: string | null }[] = [];
    let attempting = '';

    try {
      for (const a of assignments) {
        attempting = a.seatNumber;
        // ONE atomic update per passenger: the unique index rejects a seat that is already taken
        // and leaves the passenger's old seat untouched.
        const before = await this.seatClaimModel.findOneAndUpdate(
          { booking: bookingObjectId, flight: flightObjectId, passengerIndex: a.passengerIndex },
          { $set: { seatNumber: a.seatNumber, cabinClass: segment.cabinClass } },
          { upsert: true, returnDocument: 'before' },
        );
        previous.push({ passengerIndex: a.passengerIndex, seatNumber: before?.seatNumber ?? null });
      }
    } catch (err: any) {
      await this.restoreSeats(bookingObjectId, flightObjectId, previous, segment.cabinClass);
      if (err?.code === 11000) {
        throw new ConflictException(`Seat ${attempting} was just taken. Please pick another seat.`);
      }
      throw err;
    }

    // the booking may have been cancelled or expired while we were claiming
    const fresh = await this.bookingModel.findById(bookingObjectId).select('status').lean();
    if (!fresh || ![BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED].includes(fresh.status)) {
      await this.releaseSeats(bookingObjectId, flightObjectId);
      throw new ConflictException('The booking is no longer active, so no seats were assigned');
    }

    const claims = await this.seatClaimModel
      .find({ booking: bookingObjectId, flight: flightObjectId })
      .sort({ passengerIndex: 1 })
      .lean();
    return {
      bookingId: booking.id,
      flightId: dto.flightId,
      flightNumber: flight.flightNumber,
      cabinClass: segment.cabinClass,
      seats: claims.map((c) => ({
        passengerIndex: c.passengerIndex,
        passengerName: booking.passengers[c.passengerIndex]?.fullName ?? null,
        seatNumber: c.seatNumber,
      })),
    };
  }

  /** Puts the passengers' previous seats back when a multi-seat request fails half way. */
  private async restoreSeats(
    bookingId: Types.ObjectId,
    flightId: Types.ObjectId,
    previous: { passengerIndex: number; seatNumber: string | null }[],
    cabinClass: CabinClass,
  ) {
    for (const p of previous) {
      const filter = { booking: bookingId, flight: flightId, passengerIndex: p.passengerIndex };
      try {
        if (p.seatNumber) {
          await this.seatClaimModel.updateOne(filter, { $set: { seatNumber: p.seatNumber, cabinClass } });
        } else {
          await this.seatClaimModel.deleteOne(filter);
        }
      } catch (err) {
        this.logger.error(`Could not restore seat of passenger ${p.passengerIndex} on booking ${bookingId}`, err as Error);
      }
    }
  }

  /** FLT-28: the seats of one of my bookings. */
  async getSeats(bookingId: string, user: CurrentUserLike) {
    const booking = await this.findOne(bookingId, user); // 404 if missing or not mine
    const claims = await this.seatClaimModel.find({ booking: booking._id }).sort({ flight: 1, passengerIndex: 1 }).lean();
    return {
      bookingId: booking.id,
      assignments: claims.map((c) => ({
        flightId: c.flight.toString(),
        cabinClass: c.cabinClass,
        passengerIndex: c.passengerIndex,
        passengerName: booking.passengers[c.passengerIndex]?.fullName ?? null,
        seatNumber: c.seatNumber,
      })),
    };
  }

  async getFlightChangePayable(
    bookingId: string,
    changeId: string,
    userId: string,
  ) {
    const booking = await this.loadOwn(bookingId, userId);
    const pending = booking.pendingChange;

    if (
      booking.status !== BookingStatus.CONFIRMED ||
      !pending ||
      pending.changeId !== changeId ||
      pending.status !== FlightChangeStatus.PENDING_PAYMENT
    ) {
      throw new ConflictException('This flight change is not waiting for payment');
    }

    if (!pending.expiresAt || pending.expiresAt <= new Date()) {
      throw new ConflictException('The flight change payment period has expired');
    }

    return {
      bookingId: booking.id,
      changeId,
      kind: 'FLIGHT_CHANGE' as const,
      amount: pending.fareDifference,
      currency: booking.currency,
      holdExpiresAt: pending.expiresAt,
      description: `Flight change for booking ${booking.reference}`,
    };
  }
}
