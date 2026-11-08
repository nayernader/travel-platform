import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { FlightBookingsService } from './flight-bookings.service';
import { BookingRequestDto } from './dto/booking.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Flight Bookings')
@Controller('flight-bookings')
export class FlightBookingsController {
  constructor(private readonly bookings: FlightBookingsService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({
    summary: 'Check passengers and get the booking summary before payment (reserves no seats)',
    description:
      'FLT-19, FLT-21. Validates the flights, passenger types and extra baggage, and returns the price breakdown and total.',
  })
  @ApiResponse({ status: 201, description: 'Booking summary with seats, segments, baggage fee and total' })
  @ApiResponse({ status: 400, description: 'Invalid passengers, baggage or flight cannot be booked' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users can book' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'Not enough seats in the selected cabin' })
  summary(@Body() dto: BookingRequestDto) {
    return this.bookings.summarize(dto);
  }

  @Auth(Role.USER)
  @Post('hold')
  @ApiOperation({
    summary: 'Hold the seats for 10 minutes and create a Pending Payment booking',
    description:
      'FLT-22, GEN-11. Same body as the summary. Seats are taken in one atomic update; if payment does not succeed within 10 minutes the booking expires and the seats are released.',
  })
  @ApiResponse({ status: 201, description: 'Booking created in PENDING_PAYMENT with holdExpiresAt' })
  @ApiResponse({ status: 400, description: 'Invalid passengers, baggage or flight cannot be booked' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Only registered users can book' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'Not enough seats left (someone else was faster)' })
  hold(@Body() dto: BookingRequestDto, @CurrentUser() user: UserDocument) {
    return this.bookings.hold(dto, user.id);
  }
}