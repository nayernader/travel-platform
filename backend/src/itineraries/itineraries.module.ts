import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
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
import { ItinerarySharingService } from './itinerary-sharing.service';
import { PublicItinerariesController, ItineraryCloneController } from './itinerary-sharing.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Itinerary.name, schema: ItinerarySchema },
      { name: User.name, schema: UserSchema },
    ]),
    UploadsModule,
  ],
  controllers: [
    PublicItinerariesController, // must come before ItinerariesController ("public" is not an :id)
    ItinerariesController,
    ItineraryDaysController,
    DayActivitiesController,
    ActivitiesController,
    ItineraryBudgetRoutesController,
    BudgetsController,
    TransportCostsController,
    ItineraryCloneController,
  ],
  providers: [
    ItinerariesService,
    ItineraryDaysService,
    ItineraryActivitiesService,
    ItineraryBudgetsService,
    ItinerarySharingService,
  ],
  exports: [
    ItinerariesService,
    ItineraryDaysService,
    ItineraryActivitiesService,
    ItineraryBudgetsService,
    ItinerarySharingService,
    MongooseModule,
  ],
})
export class ItinerariesModule {}