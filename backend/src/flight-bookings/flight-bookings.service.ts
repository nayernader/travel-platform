import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DateTime } from 'luxon';

import { BookingRequestDto, PassengerDto, SegmentDto } from './dto/booking.dto';
import { PassengerType } from './schemas/flight-booking.schema';
import { Cabin, Flight, FlightDocument, FlightStatus } from '../flights/schemas/flight.schema';
import { Airline, AirlineDocument } from '../airlines/schemas/airline.schema';

const INFANT_FARE_RATE = 0.1; // FLT-12(b): infants pay 10% of the fare and take no seat

@Injectable()
export class FlightBookingsService {
  constructor(
    @InjectModel(Flight.name) private flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
  ) {}

  /** Age in whole years on the given day. */
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

  async summarize(dto: BookingRequestDto) {
    const loaded = await this.loadSegments(dto.segments);

    // age is measured on the day of the outbound flight
    const counts = this.checkPassengers(dto.passengers, loaded[0].flight.departureTimeUtc);
    const seats = counts.adults + counts.children; // infants sit on laps

    for (const { flight, cabin } of loaded) {
      if (cabin.availableSeats < seats) {
        throw new ConflictException(
          `Not enough ${cabin.cabinClass} seats on flight ${flight.flightNumber}`,
        );
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

    const baggageFee = 0; // added once the airline's baggage policy is saved (Ahmed's fix)
    const total = round(segments.reduce((sum, s) => sum + s.subtotal, 0) + baggageFee);

    return { ...counts, seats, segments, baggageFee, total, currency: 'USD' };
  }
}