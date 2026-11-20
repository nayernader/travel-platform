
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
    @InjectConnection() private readonly connection: Connection,
  ) {}


  getPayable(type: BookingType, id: string, userId: string) {
    return type === 'flight'
      ? this.flights.getPayable(id, userId)
      : this.hotels.getPayable(id, userId);
  }

  confirmPaid(type: BookingType, id: string, paymentId: string): Promise<any> {
    return type === 'flight'
      ? this.flights.markPaid(id, paymentId)
      : this.hotels.confirmPaid(id, paymentId);
  }

  getFlightChangePayable(bookingId: string, changeId: string, userId: string) {
    return this.flights.getFlightChangePayable(bookingId, changeId, userId);
  }

  completeFlightChangePayment(bookingId: string, changeId: string) {
    return this.flights.completeChangePayment(bookingId, changeId);
  }

  completeFlightChangeRefund(bookingId: string, changeId: string) {
    return this.flights.completeChangeRefund(bookingId, changeId);
  }

  failFlightChange(bookingId: string, changeId: string) {
    return this.flights.failPendingChange(bookingId, changeId);
  }

  async get(type: BookingType, id: string) {
    const booking = await this.connection
      .model(type === 'flight' ? 'FlightBooking' : 'HotelBooking')
      .findById(id);

    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
  
}
