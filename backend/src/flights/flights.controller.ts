import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';

import { FlightsService } from './flights.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { CreateCabinDto } from './dto/cabin.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { SearchFlightsDto } from './dto/search-flights.dto';

@ApiTags('Flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Auth(Role.AIRLINE_MODERATOR)
  @Post()
  @ApiOperation({
    summary: 'Create a flight for my airline (FLT-03). Times are LOCAL, stored in UTC.',
  })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateFlightDto) {
    return this.flights.create(user, dto);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Post(':id/cabins')
  @ApiOperation({ summary: 'Add a cabin category to my flight (FLT-04)' })
  addCabin(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: CreateCabinDto,
  ) {
    return this.flights.addCabin(user, id, dto);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel one of my Scheduled flights',
    description:
      'FLT-06. The flight becomes CANCELLED and disappears from search. Confirmed bookings are cancelled with a 100% refund, pending holds are released, and passengers are notified.',
  })
  @ApiResponse({ status: 201, description: 'Flight cancelled, with the number of bookings cancelled and holds released' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'The flight is not Scheduled (already cancelled or departed)' })
    @Auth(Role.AIRLINE_MODERATOR)
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel one of my Scheduled flights',
    description:
      'FLT-06. The flight becomes CANCELLED and disappears from search. Confirmed bookings are cancelled with a 100% refund, pending holds are released, and passengers are notified.',
  })
  @ApiResponse({ status: 201, description: 'Flight cancelled, with the number of bookings cancelled and holds released' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'The flight is not Scheduled (already cancelled or departed)' })
  cancel(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.flights.cancel(user, id);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search one-way or round-trip flights by route, local date and passengers',
    description:
      'FLT-11, FLT-12(a), FLT-15. Without returnDate: a page of flights. With returnDate: { outbound, return }, each a page with the same filters, sorting and pagination.',
  })
  @ApiResponse({ status: 200, description: 'One-way: a page of flights. Round trip: { outbound, return }' })
  @ApiResponse({ status: 400, description: 'Invalid input, same airports, unknown airport, or returnDate before date' })
  search(@Query() query: SearchFlightsDto) {
    return this.flights.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Flight details with local times (FLT-17 uses this)' })
  findOne(@Param('id') id: string) {
    return this.flights.findOneView(id);
  }
}
