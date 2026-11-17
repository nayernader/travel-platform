import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { FlightBookingsService } from '../flight-bookings/flight-bookings.service';
import { HotelBookingsService } from '../hotel-bookings/hotel-bookings.service';

export type BookingType = 'flight' | 'hotel';

@Injectable()
export class BookingPort {
  constructor(
    private readonly flights: FlightBookingsService,
    private readonly hotels: HotelBookingsService,
    @InjectConnection() private connection: Connection,
  ) {}

  getPayable(type: BookingType, id: string, userId: string) {
    return type === 'flight' ? this.flights.getPayable(id, userId) : this.hotels.getPayable(id, userId);
  }

  confirmPaid(type: BookingType, id: string, paymentId: string): Promise<any> {
       return type === 'flight' ? this.flights.markPaid(id, paymentId) : this.hotels.confirmPaid(id, paymentId);
  }

  async get(type: BookingType, id: string) {
    const b = await this.connection.model(type === 'flight' ? 'FlightBooking' : 'HotelBooking').findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }
}