import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadsModule } from '../uploads/uploads.module';
import { Hotel, HotelSchema } from './schemas/hotel.schema';
import { Room, RoomSchema } from './schemas/room.schema';
import { HotelsService } from './hotels.service';
import { HotelsController } from './hotels.controller';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { AvailabilityService } from './availability.service';

@Module({
  imports: [
    UploadsModule,
    MongooseModule.forFeature([
      { name: Hotel.name, schema: HotelSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  // Member 5 will add HotelSearchController FIRST in this array.
  controllers: [HotelsController, RoomsController],
  providers: [HotelsService, RoomsService, AvailabilityService],
  exports: [HotelsService, RoomsService, AvailabilityService, MongooseModule],
})
export class HotelsModule {}
