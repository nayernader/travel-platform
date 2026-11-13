import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { RoomsService } from './rooms.service';
import { AvailabilityService } from './availability.service';

import {
  AddRangeDto,
  ReplaceAvailabilityDto,
} from './dto/availability.dto';

import {
  CreateRoomDto,
  UpdateRoomDto,
} from './dto/room.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Hotel rooms')
@Controller('hotels/:hotelId/rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Auth(Role.HOTEL_MODERATOR)
  @Post(':roomId/availability')
  @ApiOperation({
    summary: 'Add a bookable range or a blocked range for a room',
    description: 'HTL-04, HTL-06',
  })
  addRange(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() dto: AddRangeDto,
  ) {
    return this.availability.add(user, hotelId, roomId, dto);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Patch(':roomId/availability')
  @ApiOperation({
    summary: 'Replace the room availability ranges',
    description: 'HTL-05',
  })
  replaceRanges(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() dto: ReplaceAvailabilityDto,
  ) {
    return this.availability.replace(user, hotelId, roomId, dto);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Post()
  @ApiOperation({
    summary: 'Add a room to my hotel',
    description: 'HTL-03',
  })
  create(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Body() dto: CreateRoomDto,
  ) {
    return this.rooms.create(user, hotelId, dto);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Patch(':roomId')
  @ApiOperation({
    summary: 'Edit beds, occupancy, price, type',
    description: 'HTL-05',
  })
  update(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateRoomDto,
  ) {
    return this.rooms.update(user, hotelId, roomId, dto);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Patch(':roomId/deactivate')
  @ApiOperation({
    summary: 'Deactivate a room. Rejected when it has active reservations.',
    description: 'HTL-06',
  })
  deactivate(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
  ) {
    return this.rooms.deactivate(user, hotelId, roomId);
  }

  @Auth(Role.HOTEL_MODERATOR)
  @Delete(':roomId')
  @ApiOperation({
    summary: 'Delete a room that was never reserved',
    description: 'HTL-06',
  })
  remove(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
  ) {
    return this.rooms.remove(user, hotelId, roomId);
  }
}

// ==========================================
// HTL-08: Hotel Availability Status
// ==========================================

@ApiTags('Hotel rooms')
@Controller('hotels/:hotelId/availability')
export class HotelAvailabilityController {
  constructor(
    private readonly availability: AvailabilityService,
  ) {}

  @Auth(Role.HOTEL_MODERATOR)
  @Get()
  @ApiOperation({
    summary:
      'Room status for a date range: AVAILABLE, BOOKED (with reference) or BLOCKED (HTL-08)',
  })
  @ApiQuery({ name: 'from', example: '2026-12-10' })
  @ApiQuery({ name: 'to', example: '2026-12-15' })
  status(
    @CurrentUser() user: UserDocument,
    @Param('hotelId') hotelId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.availability.roomStatus(
      user,
      hotelId,
      from,
      to,
    );
  }
}