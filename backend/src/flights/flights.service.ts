import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Schema as MongooseSchema } from 'mongoose';
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

@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Flight.name) private model: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    private readonly ref: ReferenceDataService,
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

  // ---------------- FLT-30: auto Departed ----------------
  @Cron(CronExpression.EVERY_MINUTE)
  async markDeparted() {
    await this.model.updateMany(
      { status: FlightStatus.SCHEDULED, departureTimeUtc: { $lte: new Date() } },
      { status: FlightStatus.DEPARTED },
    );
  }

  // ---------------- FLT-11: Search ----------------
  async search(q: SearchFlightsDto){

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
