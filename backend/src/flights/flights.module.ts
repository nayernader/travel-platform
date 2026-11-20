import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Flight, FlightSchema } from './schemas/flight.schema';
import { FlightsService } from './flights.service';
import { FlightsController } from './flights.controller';

import { AirlinesModule } from '../airlines/airlines.module';

import { FlightBooking, FlightBookingSchema } from '../flight-bookings/schemas/flight-booking.schema';

import { ReferenceDataModule } from '../reference-data/reference-data.module';
import { SeatClaim, SeatClaimSchema } from '../flight-bookings/schemas/seat-claim.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Flight.name, schema: FlightSchema },
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: SeatClaim.name, schema: SeatClaimSchema },
    ]),
    ReferenceDataModule,
    AirlinesModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService, MongooseModule],
})
export class FlightsModule {}
