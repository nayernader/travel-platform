import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Itinerary, ItinerarySchema } from './schemas/itinerary.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { HotelsModule } from '../hotels/hotels.module';
import { FlightsModule } from '../flights/flights.module';
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
import { ItineraryBudgetSummaryService } from './itinerary-budget-summary.service';
import { ItineraryBudgetSummaryController } from './itinerary-budget-summary.controller';
import { ItinerarySuggestionsService } from './itinerary-suggestions.service';
import { ItinerarySuggestionsController } from './itinerary-suggestions.controller';
import { FlightBooking, FlightBookingSchema } from '../flight-bookings/schemas/flight-booking.schema';
import { HotelBooking, HotelBookingSchema } from '../hotel-bookings/schemas/hotel-booking.schema';
import { ItineraryBookingsService } from './itinerary-bookings.service';
import { ItineraryBookingsController } from './itinerary-bookings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Itinerary.name, schema: ItinerarySchema },
      { name: User.name, schema: UserSchema },
      { name: FlightBooking.name, schema: FlightBookingSchema },
      { name: HotelBooking.name, schema: HotelBookingSchema },
    ]),
    UploadsModule,
    ExchangeRatesModule,
    HotelsModule, // exports HotelSearchService
    FlightsModule, // exports FlightsService
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
    ItineraryBudgetSummaryController,
    ItinerarySuggestionsController,
    ItineraryCloneController,
    ItineraryBookingsController,
  ],
  providers: [
    ItinerariesService,
    ItineraryDaysService,
    ItineraryActivitiesService,
    ItineraryBudgetsService,
    ItinerarySharingService,
    ItineraryBudgetSummaryService,
    ItinerarySuggestionsService,
    ItineraryBookingsService,
  ],
  exports: [
    ItinerariesService,
    ItineraryDaysService,
    ItineraryActivitiesService,
    ItineraryBudgetsService,
    ItinerarySharingService,
    ItineraryBudgetSummaryService,
    ItinerarySuggestionsService,
    MongooseModule,
  ],
})
export class ItinerariesModule {}
