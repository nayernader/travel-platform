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
import { HotelBookingsController } from './hotel-bookings.controller';
import { HotelBookingsService } from './hotel-bookings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HotelBooking.name, schema: HotelBookingSchema },
      { name: RoomNight.name, schema: RoomNightSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
    HotelsModule,
  ],
  controllers: [HotelBookingsController],
  providers: [HotelBookingsService],
  exports: [MongooseModule, HotelBookingsService],
})
export class HotelBookingsModule {}
