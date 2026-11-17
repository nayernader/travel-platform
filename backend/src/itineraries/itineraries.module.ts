import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { ItinerariesService } from './itineraries.service';
import { ItinerariesController } from './itineraries.controller';
import { ItineraryDaysService } from './itinerary-days.service';
import { ItineraryDaysController } from './itinerary-days.controller';
import { ItineraryActivitiesService } from './itinerary-activities.service';
import { DayActivitiesController, ActivitiesController } from './itinerary-activities.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }]), UploadsModule],
  controllers: [ItinerariesController, ItineraryDaysController, DayActivitiesController, ActivitiesController],
  providers: [ItinerariesService, ItineraryDaysService, ItineraryActivitiesService],
  exports: [ItinerariesService, ItineraryDaysService, ItineraryActivitiesService, MongooseModule],
})
export class ItinerariesModule {}