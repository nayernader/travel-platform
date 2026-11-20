import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema, Types } from 'mongoose';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';
import { FlightBooking, FlightBookingDocument } from '../flight-bookings/schemas/flight-booking.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { DateTime } from 'luxon';

import { Flight, FlightDocument, FlightStatus } from './schemas/flight.schema';
import { CreateFlightDto } from './dto/create-flight.dto';
import { CreateCabinDto } from './dto/cabin.dto';
import { toFlightView } from './flight.view';

import { ReferenceDataService } from '../reference-data/reference-data.service';
import { UserDocument } from '../users/schemas/user.schema';
import { Airline, AirlineDocument } from '../airlines/schemas/airline.schema';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { FlightSortBy, SearchFlightsDto, SortOrder } from './dto/search-flights.dto';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { FLIGHT_CANCELLED, FlightCancelledEvent } from '../common/events/flight-cancelled.event';

/** FLT-29: one CSV cell. Quotes values with commas or quotes, and defuses Excel formulas (=, +, -, @). */
function csvCell(value: unknown): string {
  let s = value === undefined || value === null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Flight.name) private model: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    @InjectModel(FlightBooking.name) private bookingModel: Model<FlightBookingDocument>,
    private readonly ref: ReferenceDataService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}


  /** The airline always comes from the logged-in moderator, never from the request body. */
  private requireAirline(user: UserDocument): MongooseSchema.Types.ObjectId {
    if (!user.providerId) {
      throw new ForbiddenException('No airline is assigned to your account');
    }
    return user.providerId as unknown as MongooseSchema.Types.ObjectId;
  }

  /** Returns the IANA time zone of an airport, or fails clearly. */
  private zoneOf(airport: any): string {
    const zone = airport?.timezone;
    if (!zone) throw new BadRequestException('Airport has no time zone');
    return zone;
  }

  /** Reads a local date-time string in the airport's time zone. */
  private toUtc(local: string, zone: string) {
    const dt = DateTime.fromISO(local, { zone });
    if (!dt.isValid) throw new BadRequestException('Invalid date-time');
    return dt;
  }

  // ---------------- FLT-03: create flight ----------------
  async create(user: UserDocument, dto: CreateFlightDto) {
    const airline = this.requireAirline(user);

    const depCode = dto.departureAirport.toUpperCase();
    const arrCode = dto.arrivalAirport.toUpperCase();

    if (depCode === arrCode) {
      throw new BadRequestException('Departure and arrival airports must differ');
    }

    const dep = await this.ref.findAirport(depCode);
    const arr = await this.ref.findAirport(arrCode);
    if (!dep || !arr) throw new BadRequestException('Unknown airport code');

    const depLocal = this.toUtc(dto.departureLocal, this.zoneOf(dep));
    const arrLocal = this.toUtc(dto.arrivalLocal, this.zoneOf(arr));
    const departureTimeUtc = depLocal.toUTC().toJSDate();
    const arrivalTimeUtc = arrLocal.toUTC().toJSDate();

    if (arrivalTimeUtc <= departureTimeUtc) {
      throw new BadRequestException('Arrival must be after departure');
    }
    if (departureTimeUtc <= new Date()) {
      throw new BadRequestException('Departure cannot be in the past');
    }

    try {
      const flight = await this.model.create({
        airline,
        flightNumber: dto.flightNumber.toUpperCase(),
        departureAirport: depCode,
        arrivalAirport: arrCode,
        departureTimeUtc,
        arrivalTimeUtc,
        departureDate: depLocal.toFormat('yyyy-LL-dd'),
      });
      return toFlightView(flight, dep, arr);
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ConflictException(
          'This airline already has that flight number on that date',
        );
      }
      throw e;
    }
  }

   async findOneView(id: string) {
    const flight = await this.model.findById(id);
    if (!flight) throw new NotFoundException('Flight not found');
    const dep = await this.ref.findAirport(flight.departureAirport);
    const arr = await this.ref.findAirport(flight.arrivalAirport);

    const airline = await this.airlineModel.findById(flight.airline).lean();
    const durationMinutes = Math.round(
      (flight.arrivalTimeUtc.getTime() - flight.departureTimeUtc.getTime()) / 60000,
    );

    return {
      ...toFlightView(flight, dep, arr),
      durationMinutes,
      airlineName: airline?.name ?? null,
      airlineCode: airline?.code ?? null,
      cancellationPolicy: (airline as any)?.cancellationPolicy ?? [],
    };
  }

  // ---------------- FLT-04: cabins ----------------
  /** Loads a flight and checks that it belongs to the moderator's airline. */
  async getOwned(user: UserDocument, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Flight not found');
    const flight = await this.model.findById(id);
    if (!flight) throw new NotFoundException('Flight not found');
    if (!user.providerId || flight.airline.toString() !== user.providerId.toString()) {
      throw new ForbiddenException('This flight belongs to another airline');
    }
    return flight;
  }

  async addCabin(user: UserDocument, id: string, dto: CreateCabinDto) {
    const flight = await this.getOwned(user, id);
    if (flight.status !== FlightStatus.SCHEDULED) {
      throw new BadRequestException('Only Scheduled flights can be edited');
    }
    if (flight.cabins.some((c) => c.cabinClass === dto.cabinClass)) {
      throw new ConflictException(`${dto.cabinClass} already exists on this flight`);
    }
    flight.cabins.push({ ...dto, availableSeats: dto.totalSeats } as any);
    await flight.save();
    return flight;
  }

    // ---------------- FLT-06: cancel flight ----------------
  async cancel(user: UserDocument, id: string) {
    const flight = await this.getOwned(user, id); // 404 if missing, 403 if another airline's

    // atomic: only a Scheduled flight can be cancelled. New holds stop at once,
    // because takeSeats() only works on SCHEDULED flights.
    const cancelled = await this.model.findOneAndUpdate(
      { _id: flight._id, status: FlightStatus.SCHEDULED },
      { $set: { status: FlightStatus.CANCELLED } },
      { returnDocument: 'after' },
    );
    if (!cancelled) {
      throw new ConflictException(`A ${flight.status} flight cannot be cancelled`);
    }

    // the bookings module cancels the bookings, refunds 100% and notifies the passengers
    const [result] = await this.events.emitAsync(
      FLIGHT_CANCELLED,
      new FlightCancelledEvent(
        cancelled.id,
        cancelled.flightNumber,
        `${cancelled.departureAirport} to ${cancelled.arrivalAirport}`,
        cancelled.departureTimeUtc,
      ),
    );

    return {
      flightId: cancelled.id,
      flightNumber: cancelled.flightNumber,
      status: cancelled.status,
      ...(result ?? { cancelledBookings: 0, expiredHolds: 0 }),
    };
  }

    // ---------------- FLT-05: edit flight ----------------
  async update(user: UserDocument, id: string, dto: UpdateFlightDto) {
    const flight = await this.getOwned(user, id); // 404, or 403 if another airline's
    if (flight.status !== FlightStatus.SCHEDULED) {
      throw new BadRequestException('Only Scheduled flights can be edited');
    }
    if (!dto.departureAirport && !dto.arrivalAirport && !dto.departureLocal && !dto.arrivalLocal) {
      throw new BadRequestException('Nothing to update');
    }

    const depCode = dto.departureAirport?.toUpperCase() ?? flight.departureAirport;
    const arrCode = dto.arrivalAirport?.toUpperCase() ?? flight.arrivalAirport;
    if (depCode === arrCode) {
      throw new BadRequestException('Departure and arrival airports must differ');
    }

    // airports cannot change once the flight has bookings (confirmed or still held)
    const airportsChanged = depCode !== flight.departureAirport || arrCode !== flight.arrivalAirport;
    if (airportsChanged) {
      if (!dto.departureLocal || !dto.arrivalLocal) {
        throw new BadRequestException(
          'When an airport changes, send both departureLocal and arrivalLocal (the time zone changes too)',
        );
      }
      const hasBookings = await this.bookingModel.exists({
        'segments.flight': flight._id,
        status: { $in: [BookingStatus.CONFIRMED, BookingStatus.PENDING_PAYMENT] },
      });
      if (hasBookings) {
        throw new ConflictException('Airports cannot be changed once the flight has bookings');
      }
    }

    const dep = await this.ref.findAirport(depCode);
    const arr = await this.ref.findAirport(arrCode);
    if (!dep || !arr) throw new BadRequestException('Unknown airport code');

    // times: local, in each airport's zone, stored in UTC (same as FLT-03)
    let departureTimeUtc = flight.departureTimeUtc;
    let arrivalTimeUtc = flight.arrivalTimeUtc;
    let departureDate = flight.departureDate;
    if (dto.departureLocal) {
      const local = this.toUtc(dto.departureLocal, this.zoneOf(dep));
      departureTimeUtc = local.toUTC().toJSDate();
      departureDate = local.toFormat('yyyy-LL-dd');
    }
    if (dto.arrivalLocal) {
      arrivalTimeUtc = this.toUtc(dto.arrivalLocal, this.zoneOf(arr)).toUTC().toJSDate();
    }
    if (arrivalTimeUtc <= departureTimeUtc) {
      throw new BadRequestException('Arrival must be after departure');
    }
    if (departureTimeUtc <= new Date()) {
      throw new BadRequestException('Departure cannot be in the past');
    }

    let updated: FlightDocument | null;
    try {
      updated = await this.model.findOneAndUpdate(
        { _id: flight._id, status: FlightStatus.SCHEDULED },
        {
          $set: {
            departureAirport: depCode,
            arrivalAirport: arrCode,
            departureTimeUtc,
            arrivalTimeUtc,
            departureDate,
          },
        },
        { returnDocument: 'after' },
      );
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ConflictException('This airline already has that flight number on that date');
      }
      throw e;
    }
    if (!updated) throw new ConflictException('The flight is no longer Scheduled');

    const view = toFlightView(updated, dep, arr);

    const timeChanged =
      departureTimeUtc.getTime() !== flight.departureTimeUtc.getTime() ||
      arrivalTimeUtc.getTime() !== flight.arrivalTimeUtc.getTime();
    if (timeChanged) await this.notifySchedulePassengers(updated, view);

    return view;
  }

  /** FLT-05: passengers with CONFIRMED bookings are told about the new times. */
  private async notifySchedulePassengers(
    flight: FlightDocument,
    view: { departureLocal: string; departureTimeZone: string; arrivalLocal: string; arrivalTimeZone: string },
  ) {
    const bookings = await this.bookingModel
      .find({ 'segments.flight': flight._id, status: BookingStatus.CONFIRMED })
      .select('user reference')
      .lean();

    for (const b of bookings) {
      await this.notifications.notify(
        b.user,
        NotificationType.FLIGHT_SCHEDULE_CHANGED,
        `The schedule of flight ${flight.flightNumber} (${flight.departureAirport} to ${flight.arrivalAirport}) changed. ` +
          `It now departs ${view.departureLocal.replace('T', ' ')} (${view.departureTimeZone}) and arrives ` +
          `${view.arrivalLocal.replace('T', ' ')} (${view.arrivalTimeZone}). Your booking ${b.reference} is still valid.`,
        { bookingId: b._id.toString(), reference: b.reference, flightId: flight.id },
      );
    }
  }

  /** FLT-05: price, seat count and baggage rules of one cabin. Existing bookings keep their own unitPrice. */
  async updateCabin(user: UserDocument, id: string, cabinId: string, dto: UpdateCabinDto) {
    const flight = await this.getOwned(user, id);
    if (flight.status !== FlightStatus.SCHEDULED) {
      throw new BadRequestException('Only Scheduled flights can be edited');
    }
    if (Object.values(dto).every((v) => v === undefined)) {
      throw new BadRequestException('Nothing to update');
    }
    if (!Types.ObjectId.isValid(cabinId)) throw new NotFoundException('Cabin not found');
    const cabin = flight.cabins.find((c: any) => c._id.toString() === cabinId);
    if (!cabin) throw new NotFoundException('Cabin not found');

    const set: Record<string, number> = {};
    if (dto.price !== undefined) set['cabins.$.price'] = dto.price;
    if (dto.freeBags !== undefined) set['cabins.$.freeBags'] = dto.freeBags;
    if (dto.maxBagWeightKg !== undefined) set['cabins.$.maxBagWeightKg'] = dto.maxBagWeightKg;

    const update: Record<string, any> = {};
    if (Object.keys(set).length) update.$set = set;
    const match: Record<string, any> = { _id: new Types.ObjectId(cabinId) };

    if (dto.totalSeats !== undefined) {
      const bookedOrHeld = cabin.totalSeats - cabin.availableSeats;
      if (dto.totalSeats < bookedOrHeld) {
        throw new ConflictException(
          `${cabin.cabinClass} cannot go below ${bookedOrHeld} seats: they are already booked or held`,
        );
      }
      const diff = dto.totalSeats - cabin.totalSeats;
      // the same difference is applied to the available seats, in ONE atomic update.
      // The filter makes it fail if a hold took seats in the meantime.
      match.totalSeats = cabin.totalSeats;
      match.availableSeats = { $gte: -diff };
      update.$inc = { 'cabins.$.totalSeats': diff, 'cabins.$.availableSeats': diff };
    }

    const updated = await this.model.findOneAndUpdate(
      { _id: flight._id, status: FlightStatus.SCHEDULED, cabins: { $elemMatch: match } },
      update,
      { returnDocument: 'after' },
    );
    if (!updated) {
      throw new ConflictException('The cabin was changed at the same time. Please try again.');
    }
    return updated.cabins.find((c: any) => c._id.toString() === cabinId);
  }
    // ---------------- FLT-29: bookings and passenger export ----------------
  /** Bookings of a flight that the airline needs to see: Confirmed and Cancelled. */
  private flightBookingsFilter(flightId: Types.ObjectId) {
    return {
      'segments.flight': flightId, // indexed
      status: { $in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
    };
  }

  /** The cabin this booking uses on THIS flight (a round trip has two segments). */
  private cabinOnFlight(booking: { segments: { flight: Types.ObjectId; cabinClass: string }[] }, flightId: string) {
    return booking.segments.find((s) => s.flight.toString() === flightId)?.cabinClass ?? null;
  }

  /** FLT-29: the bookings of my flight (10 per page) and the seats remaining per cabin. */
  async listBookings(user: UserDocument, id: string, page = 1) {
    const flight = await this.getOwned(user, id); // 404, or 403 if another airline's
    const filter = this.flightBookingsFilter(flight._id as Types.ObjectId);

    const [rows, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .lean(),
      this.bookingModel.countDocuments(filter),
    ]);

    const items = rows.map((b) => ({
      bookingId: b._id.toString(),
      reference: b.reference ?? null,
      status: b.status,
      cabinClass: this.cabinOnFlight(b, flight.id),
      seats: b.seats,
      passengers: b.passengers.map((p) => ({ fullName: p.fullName, type: p.type })),
    }));

    return {
      ...buildPage(items, total, page),
      flightNumber: flight.flightNumber,
      // availableSeats already excludes seats that are booked or still held
      seatsRemaining: flight.cabins.map((c) => ({
        cabinClass: c.cabinClass,
        totalSeats: c.totalSeats,
        availableSeats: c.availableSeats,
      })),
    };
  }

  /** FLT-29: the passenger list as CSV, one row per passenger. */
  async passengersCsv(user: UserDocument, id: string) {
    const flight = await this.getOwned(user, id);
    const bookings = await this.bookingModel
      .find(this.flightBookingsFilter(flight._id as Types.ObjectId))
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const lines = [
      ['Reference', 'Status', 'Cabin', 'Seats in booking', 'Passenger', 'Type', 'Passport', 'Extra bags']
        .map(csvCell)
        .join(','),
    ];
    for (const b of bookings) {
      const cabin = this.cabinOnFlight(b, flight.id);
      for (const p of b.passengers) {
        lines.push(
          [b.reference ?? '', b.status, cabin, b.seats, p.fullName, p.type, p.passportNumber, p.extraBags]
            .map(csvCell)
            .join(','),
        );
      }
    }

    return {
      fileName: `passengers-${flight.flightNumber}-${flight.departureDate}.csv`,
      csv: '\uFEFF' + lines.join('\r\n') + '\r\n', // BOM so Excel shows non-English names correctly
    };
  }
  // ---------------- FLT-30: auto Departed ----------------
  @Cron(CronExpression.EVERY_MINUTE)
  async markDeparted() {
    await this.model.updateMany(
      { status: FlightStatus.SCHEDULED, departureTimeUtc: { $lte: new Date() } },
      { status: FlightStatus.DEPARTED },
    );
  }

    // ---------------- FLT-11 / FLT-12(a): one-way or round-trip search ----------------
  async search(q: SearchFlightsDto) {
    if (!q.returnDate) return this.searchOneWay(q); // one-way: same response as before

    // YYYY-MM-DD strings compare correctly as text
    if (q.returnDate < q.date) {
      throw new BadRequestException('Return date cannot be before the departure date');
    }

    // outbound: A to B on date. return: B to A on returnDate. Same filters, sorting and page for both.
    const outbound = await this.searchOneWay(q);
    const ret = await this.searchOneWay({
      ...q,
      departureAirport: q.arrivalAirport,
      arrivalAirport: q.departureAirport,
      date: q.returnDate,
    });

    return { outbound, return: ret };
  }
  
  // ---------------- FLT-11: one-way search ----------------
  private async searchOneWay(q: SearchFlightsDto) {

      if (q.departureAirport === q.arrivalAirport) {
      throw new BadRequestException('Departure and arrival airports must differ');
    }
      if (q.minPrice !== undefined && q.maxPrice !== undefined && q.minPrice > q.maxPrice) {
      throw new BadRequestException('Minimum price cannot be greater than maximum price');
    }

    const dep = await this.ref.findAirport(q.departureAirport);
    const arr = await this.ref.findAirport(q.arrivalAirport);
    if (!dep || !arr) {
      throw new BadRequestException('Unknown airport code');
    }



        // ACC-15: flights of deactivated airlines are hidden
    const activeAirlines = await this.airlineModel.find({ isActive: true }).select('_id').lean();
    const activeIds = activeAirlines.map((a) => a._id);

    const cabinMatch: Record<string, any> = { availableSeats: { $gte: q.passengers } };
    if (q.cabinClass) cabinMatch.cabinClass = q.cabinClass;
    if (q.minPrice !== undefined) cabinMatch.price = { ...cabinMatch.price, $gte: q.minPrice };
    if (q.maxPrice !== undefined) cabinMatch.price = { ...cabinMatch.price, $lte: q.maxPrice };

    const filter: Record<string, any> = {
      status: FlightStatus.SCHEDULED,
      departureAirport: q.departureAirport,
      arrivalAirport: q.arrivalAirport,
      departureDate: q.date,
      departureTimeUtc: { $gt: new Date() },
      airline: { $in: activeIds },
      cabins: { $elemMatch: cabinMatch },
    };

        const flights = await this.model.find(filter).lean();

    const cabinOk = (c: any) =>
      c.availableSeats >= q.passengers &&  
      (!q.cabinClass || c.cabinClass === q.cabinClass) &&
      (q.minPrice === undefined || c.price >= q.minPrice) &&
      (q.maxPrice === undefined || c.price <= q.maxPrice);

    const rows = flights.map((f) => {
      const cabins = f.cabins.filter(cabinOk);
      return {
        ...f,
        cabins,
        fromPrice: Math.min(...cabins.map((c) => c.price)),
        durationMinutes: Math.round(
          (f.arrivalTimeUtc.getTime() - f.departureTimeUtc.getTime()) / 60000,
        ),
      };
    });

    const sortValue = (r: (typeof rows)[number]) =>
      q.sortBy === FlightSortBy.PRICE
        ? r.fromPrice
        : q.sortBy === FlightSortBy.DURATION
          ? r.durationMinutes
          : r.departureTimeUtc.getTime();

    const direction = q.sortOrder === SortOrder.DESC ? -1 : 1;
    rows.sort((a, b) => direction * (sortValue(a) - sortValue(b)));

    const start = getSkip(q.page);
    const items = rows.slice(start, start + PAGE_SIZE).map((r) => toFlightView(r, dep, arr));

    const result = buildPage(items, rows.length, q.page);
    return rows.length === 0 ? { ...result, message: 'No flights found' } : result;
  }
}
