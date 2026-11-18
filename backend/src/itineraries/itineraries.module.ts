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
import { ItineraryBudgetsService } from './itinerary-budgets.service';
import {
  ItineraryBudgetRoutesController,
  BudgetsController,
  TransportCostsController,
} from './itinerary-budgets.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: Itinerary.name, schema: ItinerarySchema }]), UploadsModule],
  controllers: [
    ItinerariesController,
    ItineraryDaysController,
    DayActivitiesController,
    ActivitiesController,
    ItineraryBudgetRoutesController,
    BudgetsController,
    TransportCostsController,
  ],
  providers: [ItinerariesService, ItineraryDaysService, ItineraryActivitiesService, ItineraryBudgetsService],
  exports: [
    ItinerariesService,
    ItineraryDaysService,
    ItineraryActivitiesService,
    ItineraryBudgetsService,
    MongooseModule,
  ],
})
export class ItinerariesModule {}