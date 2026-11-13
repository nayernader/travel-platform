import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotelBookingsService } from './hotel-bookings.service';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Hotel bookings')
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly bookings: HotelBookingsService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({
    summary: 'Hold all selected rooms together for 10 minutes (HTL-16, HTL-18)',
  })
  hold(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateHotelBookingDto,
  ) {
    return this.bookings.hold(user, dto);
  }

  @Auth()
  @Get(':id')
  @ApiOperation({
    summary:
      'Reservation details: reference, rooms, dates, total, status (owner or admin)',
  })
  findOne(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookings.findOneFor(user, id);
  }
}
