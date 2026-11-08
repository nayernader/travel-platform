import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

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
    description: 'FLT-19, FLT-21',
  })
  summary(@Body() dto: BookingRequestDto) {
    return this.bookings.summarize(dto);
  }
 
}


  