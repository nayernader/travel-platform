import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { HotelBookingsService } from './hotel-bookings.service';
import { CreateHotelBookingDto } from './dto/create-hotel-booking.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator';

@ApiTags('Hotel bookings')
@Controller('hotel-bookings')
export class HotelBookingsController {
  constructor(private readonly bookings: HotelBookingsService) {}

  @Auth(Role.USER)
  @RequireVerifiedEmail()
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
  @Get()
  @ApiOperation({ summary: 'My reservations grouped upcoming, past, cancelled (HTL-20)' })
  @ApiQuery({ name: 'group', enum: ['upcoming', 'past', 'cancelled'], required: false })
  @ApiQuery({ name: 'page', required: false })
  mine(
    @CurrentUser() user: UserDocument,
    @Query('group') group: 'upcoming' | 'past' | 'cancelled' = 'upcoming',
    @Query('page') page = '1',
  ) {
    return this.bookings.listMine(user, group, Number(page) || 1);
  }

  @Auth()
  @Get(':id/cancel-preview')
  @ApiOperation({ summary: 'Refund amount if I cancel now (HTL-21)' })
  preview(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookings.refundPreview(user, id);
  }

  @Auth()
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel the whole reservation before check-in (HTL-21)' })
  cancel(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.bookings.cancel(user, id);
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
