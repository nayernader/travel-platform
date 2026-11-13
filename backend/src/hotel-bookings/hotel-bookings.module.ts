import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HotelBooking,
  HotelBookingSchema,
} from './schemas/hotel-booking.schema';
import {
  RoomNight,
  RoomNightSchema,
} from './schemas/room-night.schema';
import { Review, ReviewSchema } from './schemas/review.schema';
import { HotelsModule } from '../hotels/hotels.module';
<<<<<<< HEAD
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelBookingsService } from './hotel-bookings.service';
=======
import { NotificationsModule } from '../notifications/notifications.module';
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelReservationsController } from './hotel-reservations.controller';
import { ReviewsController } from './reviews.controller';
import { HotelBookingsService } from './hotel-bookings.service';
import { ReviewsService } from './reviews.service';
>>>>>>> origin/develop

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HotelBooking.name, schema: HotelBookingSchema },
      { name: RoomNight.name, schema: RoomNightSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    HotelsModule,
    NotificationsModule,
  ],
<<<<<<< HEAD
  controllers: [HotelBookingsController],
  providers: [HotelBookingsService],
=======
  controllers: [
    HotelBookingsController,
    HotelReservationsController,
    ReviewsController,
  ],
  providers: [HotelBookingsService, ReviewsService],
>>>>>>> origin/develop
  exports: [MongooseModule, HotelBookingsService],
})
export class HotelBookingsModule {}
