import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { FlightBookingsService } from './flight-bookings.service';
import { BookingRequestDto } from './dto/booking.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '../common/enums/role.enum';

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
}