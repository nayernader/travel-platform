import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { DateTime } from 'luxon';

import { BookingRequestDto, PassengerDto, SegmentDto } from './dto/booking.dto';
import {
  FlightBooking,
  FlightBookingDocument,
  PassengerType,
} from './schemas/flight-booking.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import {
  Cabin,
  CabinClass,
  Flight,
  FlightDocument,
  FlightStatus,
} from '../flights/schemas/flight.schema';
import { Airline, AirlineDocument } from '../airlines/schemas/airline.schema';

const INFANT_FARE_RATE = 0.1; // FLT-12(b): infants pay 10% of the fare and take no seat
const HOLD_MINUTES = 10; // FLT-22: seats are held for 10 minutes while the user pays

@Injectable()
export class FlightBookingsService {
  constructor(
    @InjectModel(Flight.name) private flightModel: Model<FlightDocument>,
    @InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>,
    @InjectModel(FlightBooking.name) private bookingModel: Model<FlightBookingDocument>,
  ) {}

  /** Age in whole years on the given day. */
  private ageOn(dateOfBirth: string, day: Date): number {
    const birth = DateTime.fromISO(dateOfBirth, { zone: 'utc' });
    if (!birth.isValid) throw new BadRequestException('Invalid date of birth');
    const on = DateTime.fromJSDate(day, { zone: 'utc' });
    if (birth > on)
      throw new BadRequestException(
        'Date of birth cannot be after the flight date',
      );
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
    const count = (t: PassengerType) =>
      passengers.filter((p) => p.type === t).length;
    const adults = count(PassengerType.ADULT);
    const infants = count(PassengerType.INFANT);
    if (adults < 1)
      throw new BadRequestException('A booking needs at least one adult');
    if (infants > adults)
      throw new BadRequestException('There cannot be more infants than adults');
    return { adults, children: count(PassengerType.CHILD), infants };
  }

  /** Loads the flight of every segment and checks that it can be booked. */
  private async loadSegments(segments: SegmentDto[]) {
    const loaded: { flight: FlightDocument; cabin: Cabin }[] = [];

    for (const s of segments) {
      const flight = await this.flightModel.findById(s.flightId);
      if (!flight) throw new NotFoundException('Flight not found');

      if (
        flight.status !== FlightStatus.SCHEDULED ||
        flight.departureTimeUtc <= new Date()
      ) {
        throw new BadRequestException(
          `Flight ${flight.flightNumber} cannot be booked`,
        );
      }

      // ACC-15: a deactivated airline cannot be booked
      const airline = await this.airlineModel
        .findById(flight.airline)
        .select('isActive')
        .lean();
      if (!airline?.isActive) {
        throw new BadRequestException(
          `Flight ${flight.flightNumber} cannot be booked`,
        );
      }

      const cabin = flight.cabins.find((c) => c.cabinClass === s.cabinClass);
      if (!cabin) {
        throw new BadRequestException(
          `Flight ${flight.flightNumber} has no ${s.cabinClass} cabin`,
        );
      }
      loaded.push({ flight, cabin });
    }

    if (loaded.length === 2) {
      const [out, ret] = loaded;
      if (out.flight.id === ret.flight.id) {
        throw new BadRequestException(
          'The outbound and return flights must be different',
        );
      }
      if (ret.flight.departureTimeUtc <= out.flight.arrivalTimeUtc) {
        throw new BadRequestException(
          'The return flight must depart after the outbound flight arrives',
        );
      }
    }
    return loaded;
  }

  /** FLT-22: takes seats from one cabin in ONE atomic update. Returns false if not enough remain. */
  private async takeSeats(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
  ): Promise<boolean> {
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
  private async returnSeats(
    flightId: string,
    cabinClass: CabinClass,
    seats: number,
  ): Promise<void> {
    await this.flightModel.updateOne(
      { _id: flightId, 'cabins.cabinClass': cabinClass },
      { $inc: { 'cabins.$.availableSeats': seats } },
    );
  }

  /** Takes seats on every segment. If one fails, gives back what was already taken and answers 409. */
  private async takeSeatsForAll(
    segments: {
      flightId: string;
      flightNumber: string;
      cabinClass: CabinClass;
    }[],
    seats: number,
  ): Promise<void> {
    const taken: typeof segments = [];
    for (const s of segments) {
      const ok = await this.takeSeats(s.flightId, s.cabinClass, seats);
      if (!ok) {
        for (const t of taken)
          await this.returnSeats(t.flightId, t.cabinClass, seats);
        throw new ConflictException(
          `Not enough ${s.cabinClass} seats on flight ${s.flightNumber}`,
        );
      }
      taken.push(s);
    }
  }

  /** FLT-19: extra bags per passenger, up to the airline's maximum; returns the total baggage fee. */
  private async baggageFee(
    loaded: { flight: any; cabin: any }[],
    passengers: {
      fullName: string;
      type: string;
      extraBags?: number;
      extraBagWeightKg?: number;
    }[],
  ): Promise<number> {
    let fee = 0;
    for (const { flight, cabin } of loaded) {
      const airline = await this.airlineModel
        .findById(flight.airline)
        .select('baggagePolicy')
        .lean();
      const policy = airline?.baggagePolicy;
      for (const p of passengers) {
        const bags = p.extraBags ?? 0;
        if (bags === 0) continue;
        if (p.type === 'INFANT') {
          throw new BadRequestException(
            `${p.fullName} is an infant and cannot have extra bags`,
          );
        }
        if (!policy) {
          throw new BadRequestException(
            `Flight ${flight.flightNumber} does not sell extra bags`,
          );
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
    const counts = this.checkPassengers(
      dto.passengers,
      loaded[0].flight.departureTimeUtc,
    );
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
      subtotal: round(
        cabin.price * seats + cabin.price * INFANT_FARE_RATE * counts.infants,
      ),
    }));

    const baggageFee = round(await this.baggageFee(loaded, dto.passengers));
    const total = round(
      segments.reduce((sum, s) => sum + s.subtotal, 0) + baggageFee,
    );

    const passengers = dto.passengers.map((p) => ({
      fullName: p.fullName,
      type: p.type,
      extraBags: p.extraBags ?? 0,
      extraBagWeightKg: p.extraBagWeightKg ?? 0,
    }));

    return {
      ...counts,
      seats,
      passengers,
      segments,
      baggageFee,
      total,
      currency: 'USD',
    };
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

      return {
        bookingId: booking.id,
        status: booking.status,
        holdExpiresAt: booking.holdExpiresAt,
        ...summary,
      };
    } catch (err) {
      // the booking could not be saved: give the seats back so they are not lost
      for (const s of summary.segments) {
        await this.returnSeats(s.flightId, s.cabinClass, summary.seats);
      }
      throw err;
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
      const booking = await this.bookingModel.findOneAndUpdate(
        { _id, status: BookingStatus.PENDING_PAYMENT },
        { $set: { status: BookingStatus.EXPIRED } },
        {  returnDocument: 'after' },
      );
      if (!booking) continue; // already confirmed or expired elsewhere

      for (const s of booking.segments) {
        await this.returnSeats(s.flight.toString(), s.cabinClass, booking.seats);
      }
    }
  }
}