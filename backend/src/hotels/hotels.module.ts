import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UploadsModule } from '../uploads/uploads.module';

import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { Room, RoomSchema } from './schemas/room.schema';

import {
  HotelBooking,
  HotelBookingSchema,
} from '../hotel-bookings/schemas/hotel-booking.schema';

import { HotelsService } from './hotels.service';
import { HotelsController } from './hotels.controller';

import { RoomsService } from './rooms.service';
<<<<<<< HEAD
import { RoomsController, HotelAvailabilityController } from './rooms.controller';
=======
import {
  RoomsController,
  HotelAvailabilityController,
} from './rooms.controller';
>>>>>>> origin/develop

import { AvailabilityService } from './availability.service';

import { HotelSearchController } from './hotel-search.controller';
import { HotelSearchService } from './hotel-search.service';

@Module({
  imports: [
    UploadsModule,
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
      { name: HotelBooking.name, schema: HotelBookingSchema },
    ]),
  ],

  controllers: [
    HotelSearchController,
    HotelsController,
    RoomsController,
    HotelAvailabilityController,
  ],

  providers: [
    HotelsService,
    RoomsService,
    AvailabilityService,
    HotelSearchService,
  ],

  exports: [
    HotelsService,
    RoomsService,
    AvailabilityService,
    HotelSearchService,
    MongooseModule,
  ],
})
export class HotelsModule {}