import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }])],
  controllers: [ItinerariesController],
  providers: [ItinerariesService],
  exports: [ItinerariesService, MongooseModule],
})
export class ItinerariesModule {}
