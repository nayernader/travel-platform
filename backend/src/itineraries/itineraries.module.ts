import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';
import { ItineraryDaysService } from './itinerary-days.service';
import { ItineraryDaysController } from './itinerary-days.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }])],
  controllers: [ItinerariesController, ItineraryDaysController],
  providers: [ItinerariesService, ItineraryDaysService],
  exports: [ItinerariesService, ItineraryDaysService, MongooseModule],
})
export class ItinerariesModule {}