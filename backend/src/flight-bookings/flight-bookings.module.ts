import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FlightBookingsController } from './flight-bookings.controller';
import { FlightBookingsService } from './flight-bookings.service';
import { FlightBooking, FlightBookingSchema } from './schemas/flight-booking.schema';
import { FlightsModule } from '../flights/flights.module';

import { AirlinesModule } from '../airlines/airlines.module';

@Module({
 imports: [
    MongooseModule.forFeature([{ name: FlightBooking.name, schema: FlightBookingSchema }]),
    FlightsModule,
    AirlinesModule,
  ],
  controllers: [FlightBookingsController],
  providers: [FlightBookingsService],
  exports: [MongooseModule, FlightBookingsService],
})
export class FlightBookingsModule {}


  