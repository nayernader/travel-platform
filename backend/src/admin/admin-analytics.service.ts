import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { AnalyticsQueryDto } from './dto/analytics.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

// A booking earns revenue once it is paid and not cancelled (GEN-11: Confirmed, later Completed)
const PAID = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

// Counters calculated for every provider in the $group stage
const COUNTERS = {
  bookings: { $sum: 1 },
  paidBookings: { $sum: { $cond: [{ $in: ['$status', PAID] }, 1, 0] } },
  cancelledBookings: { $sum: { $cond: [{ $eq: ['$status', BookingStatus.CANCELLED] }, 1, 0] } },
  revenue: { $sum: { $cond: [{ $in: ['$status', PAID] }, '$totalPrice', 0] } },
};

interface RawRow {
  _id: unknown;
  name?: string;
  bookings: number;
  paidBookings: number;
  cancelledBookings: number;
  revenue: number;
}

export interface ProviderStats {
  type: 'airline' | 'hotel';
  providerId: string;
  name: string;
  bookings: number;
  paidBookings: number;
  cancelledBookings: number;
  revenue: number;
}

/**
 * BON-01: bookings and revenue per provider (airline or hotel) over a period.
 * Read-only. Uses the same team models as ACC-17 (FlightBooking, HotelBooking, Flight, Airline, Hotel).
 */
@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly config: ConfigService,
  ) {}

  private has(name: string) {
    return this.connection.modelNames().includes(name);
  }

  private collection(name: string) {
    return this.connection.model(name).collection.collectionName;
  }

  private period(dto: AnalyticsQueryDto) {
    const to = dto.to ? new Date(dto.to) : new Date();
    if (dto.to && /^\d{4}-\d{2}-\d{2}$/.test(dto.to)) to.setUTCHours(23, 59, 59, 999);
    const from = dto.from ? new Date(dto.from) : new Date(to.getTime() - 30 * DAY_MS);
    if (from > to) throw new BadRequestException('from must be before to');
    return { from, to };
  }

  private toStats(type: 'airline' | 'hotel', rows: RawRow[]): ProviderStats[] {
    return rows.map((r) => ({
      type,
      providerId: String(r._id),
      name: r.name ?? (type === 'airline' ? 'Unknown airline' : 'Unknown hotel'),
      bookings: r.bookings,
      paidBookings: r.paidBookings,
      cancelledBookings: r.cancelledBookings,
      revenue: Math.round(r.revenue * 100) / 100,
    }));
  }

  private async airlines(from: Date, to: Date): Promise<ProviderStats[]> {
    if (!this.has('FlightBooking') || !this.has('Flight') || !this.has('Airline')) return [];
    // The airline of a booking is the airline of its first flight
    const pipeline: any[] = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $addFields: { firstFlight: { $arrayElemAt: ['$segments.flight', 0] } } },
      { $lookup: { from: this.collection('Flight'), localField: 'firstFlight', foreignField: '_id', as: 'flight' } },
      { $addFields: { airline: { $arrayElemAt: ['$flight.airline', 0] } } },
      { $group: { _id: '$airline', ...COUNTERS } },
      { $lookup: { from: this.collection('Airline'), localField: '_id', foreignField: '_id', as: 'provider' } },
      { $addFields: { name: { $arrayElemAt: ['$provider.name', 0] } } },
      { $project: { provider: 0 } },
    ];
    const rows = await this.connection.model('FlightBooking').aggregate<RawRow>(pipeline);
    return this.toStats('airline', rows);
  }

  private async hotels(from: Date, to: Date): Promise<ProviderStats[]> {
    if (!this.has('HotelBooking') || !this.has('Hotel')) return [];
    const pipeline: any[] = [
      { $match: { createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$hotel', ...COUNTERS } },
      { $lookup: { from: this.collection('Hotel'), localField: '_id', foreignField: '_id', as: 'provider' } },
      { $addFields: { name: { $arrayElemAt: ['$provider.name', 0] } } },
      { $project: { provider: 0 } },
    ];
    const rows = await this.connection.model('HotelBooking').aggregate<RawRow>(pipeline);
    return this.toStats('hotel', rows);
  }

  async bookings(dto: AnalyticsQueryDto) {
    const { from, to } = this.period(dto);
    const [airlines, hotels] = await Promise.all([
      dto.type === 'hotel' ? [] : this.airlines(from, to),
      dto.type === 'flight' ? [] : this.hotels(from, to),
    ]);

    // Highest revenue first, then most bookings
    const rows = [...airlines, ...hotels].sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings);

    const totals = rows.reduce(
      (t, r) => ({
        providers: t.providers + 1,
        bookings: t.bookings + r.bookings,
        paidBookings: t.paidBookings + r.paidBookings,
        cancelledBookings: t.cancelledBookings + r.cancelledBookings,
        revenue: Math.round((t.revenue + r.revenue) * 100) / 100,
      }),
      { providers: 0, bookings: 0, paidBookings: 0, cancelledBookings: 0, revenue: 0 },
    );

    const page = dto.page ?? 1;
    return {
      period: { from, to },
      currency: this.config.get<string>('PLATFORM_CURRENCY') ?? 'USD', // PAY-04
      totals,
      ...buildPage(rows.slice(getSkip(page), getSkip(page) + PAGE_SIZE), rows.length, page), // GEN-05
    };
  }
}
