import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Flight, FlightSchema } from './schemas/flight.schema';
import { FlightsService } from './flights.service';
import { FlightsController } from './flights.controller';

import { AirlinesModule } from '../airlines/airlines.module';

// Needed so FlightsService can inject ReferenceDataService.
// Importing it is harmless even if that module is already global.
import { ReferenceDataModule } from '../reference-data/reference-data.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Flight.name, schema: FlightSchema }]),
    ReferenceDataModule,
    AirlinesModule,
  ],
  controllers: [FlightsController],
  providers: [FlightsService],
  exports: [FlightsService, MongooseModule],
})
export class FlightsModule {}
