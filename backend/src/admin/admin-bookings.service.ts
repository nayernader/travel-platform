import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { ListBookingsDto } from './dto/bookings.dto';

@Injectable()
export class AdminBookingsService {
  constructor(@InjectConnection() private connection: Connection) {}

  private has(name: string) {
    return this.connection.modelNames().includes(name);
  }

  /** A date-only 'to' (YYYY-MM-DD) covers the whole day. */
  private range(dto: ListBookingsDto) {
    if (!dto.from && !dto.to) return undefined;
    const r: { $gte?: Date; $lte?: Date } = {};
    if (dto.from) r.$gte = new Date(dto.from);
    if (dto.to) {
      const to = new Date(dto.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dto.to)) to.setUTCHours(23, 59, 59, 999);
      r.$lte = to;
    }
    if (r.$gte && r.$lte && r.$gte > r.$lte) throw new BadRequestException('from must be before to');
    return r;
  }

  /**
   * ACC-17: read-only list of all flight and hotel bookings, newest first.
   * The date filter applies to the travel date (first flight's departure, or hotel check-in).
   * Team contracts: FlightBooking, HotelBooking, Flight are read by model name.
   */
  async list(dto: ListBookingsDto) {
    const page = dto.page ?? 1;
    const need = page * PAGE_SIZE; // enough rows from each collection to build this page of the merged list
    const range = this.range(dto);
    const status = dto.status ? { status: dto.status } : {};
    const wantFlights = (!dto.type || dto.type === 'flight') && this.has('FlightBooking');
    const wantHotels = (!dto.type || dto.type === 'hotel') && this.has('HotelBooking');

    const flightFilter: Record<string, unknown> = { ...status };
    if (wantFlights && range) {
      const flightIds = await this.connection.model('Flight').find({ departureTimeUtc: range }).distinct('_id');
      flightFilter['segments.0.flight'] = { $in: flightIds };
    }
    const hotelFilter: Record<string, unknown> = { ...status, ...(range ? { checkIn: range } : {}) };

    const [flights, flightTotal, hotels, hotelTotal] = await Promise.all([
      wantFlights
        ? this.connection
            .model('FlightBooking')
            .find(flightFilter)
            .sort({ createdAt: -1 })
            .limit(need)
            .populate('user', 'name email')
            .populate({
              path: 'segments.flight',
              select: 'flightNumber departureAirport arrivalAirport departureTimeUtc arrivalTimeUtc airline',
              populate: { path: 'airline', select: 'name' },
            })
            .lean()
        : [],
      wantFlights ? this.connection.model('FlightBooking').countDocuments(flightFilter) : 0,
      wantHotels
        ? this.connection
            .model('HotelBooking')
            .find(hotelFilter)
            .sort({ createdAt: -1 })
            .limit(need)
            .populate('user', 'name email')
            .populate('hotel', 'name')
            .lean()
        : [],
      wantHotels ? this.connection.model('HotelBooking').countDocuments(hotelFilter) : 0,
    ]);

    const rows = [
      ...(flights as any[]).map((b) => {
        const first = b.segments?.[0]?.flight;
        const last = b.segments?.[b.segments.length - 1]?.flight;
        return {
          type: 'flight',
          id: b._id,
          reference: b.reference,
          user: b.user,
          provider: first?.airline?.name,
          route: first && last ? `${first.departureAirport} -> ${last.arrivalAirport}` : undefined,
          flights: (b.segments ?? []).map((s: any) => s.flight?.flightNumber).filter(Boolean),
          from: first?.departureTimeUtc,
          to: last?.arrivalTimeUtc,
          amount: b.totalPrice,
          currency: b.currency,
          status: b.status,
          createdAt: b.createdAt,
        };
      }),
      ...(hotels as any[]).map((b) => ({
        type: 'hotel',
        id: b._id,
        reference: b.reference,
        user: b.user,
        provider: b.hotel?.name,
        rooms: b.rooms?.length ?? 0,
        from: b.checkIn,
        to: b.checkOut,
        amount: b.totalPrice,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt,
      })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return buildPage(rows.slice(getSkip(page), getSkip(page) + PAGE_SIZE), flightTotal + hotelTotal, page);
  }
}
