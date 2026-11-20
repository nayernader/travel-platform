import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HotelBookingsService } from './hotel-bookings.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Hotels')
@Controller('hotels/:id/reservations')
export class HotelReservationsController {
  constructor(private readonly bookings: HotelBookingsService) {}

  @Auth(Role.HOTEL_MODERATOR)
  @Get()
  @ApiOperation({ summary: 'Reservations of my hotel: guest, dates, status (HTL-22)' })
  list(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query('page') page = '1',
  ) {
    return this.bookings.listForHotel(user, id, Number(page) || 1);
  }
}
