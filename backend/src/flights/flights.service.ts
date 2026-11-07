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

@Injectable()
export class FlightsService {
  constructor(
    @InjectModel(Flight.name) private model: Model<FlightDocument>,
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
    return toFlightView(flight, dep, arr);
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
}