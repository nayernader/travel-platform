import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Airline, AirlineSchema } from './schemas/airline.schema';
import { Flight, FlightSchema } from '../flights/schemas/flight.schema';
import { AirlinesService } from './airlines.service';
import { AirlinesController } from './airlines.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Airline.name, schema: AirlineSchema },
      { name: Flight.name, schema: FlightSchema },
    ]),
  ],
  controllers: [AirlinesController],
  providers: [AirlinesService],
  exports: [AirlinesService, MongooseModule],
})
export class AirlinesModule {}