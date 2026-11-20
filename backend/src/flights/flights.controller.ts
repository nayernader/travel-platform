import { Body, Controller, Get, Param, Post, Patch, Query, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse, ApiProduces } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

import { FlightsService } from './flights.service';
import { CreateFlightDto } from './dto/create-flight.dto';
import { CreateCabinDto } from './dto/cabin.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';
import { SearchFlightsDto } from './dto/search-flights.dto';
import { UpdateFlightDto } from './dto/update-flight.dto';
import { UpdateCabinDto } from './dto/update-cabin.dto';

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
  cancel(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.flights.cancel(user, id);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Patch(':id')
  @ApiOperation({
    summary: 'Edit the times or airports of my Scheduled flight',
    description:
      'FLT-05. Times are LOCAL. Airports cannot change once the flight has bookings (if an airport changes, send both times). Passengers with confirmed bookings are notified of time changes.',
  })
  @ApiResponse({ status: 200, description: 'The updated flight with local times' })
  @ApiResponse({ status: 400, description: 'Invalid times or airports, nothing to update, or the flight is not Scheduled' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  @ApiResponse({ status: 409, description: 'Airports cannot change because the flight has bookings, or the flight number clashes' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateFlightDto) {
    return this.flights.update(user, id, dto);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Patch(':id/cabins/:cabinId')
  @ApiOperation({
    summary: 'Edit the price, seats or baggage rules of one cabin of my flight',
    description:
      'FLT-05. Seats cannot go below the seats already booked or held. Available seats change by the same difference. Existing bookings keep their agreed price.',
  })
  @ApiResponse({ status: 200, description: 'The updated cabin' })
  @ApiResponse({ status: 400, description: 'Invalid values, nothing to update, or the flight is not Scheduled' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight or cabin not found' })
  @ApiResponse({ status: 409, description: 'Seat count is below the booked or held seats' })
  updateCabin(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('cabinId') cabinId: string,
    @Body() dto: UpdateCabinDto,
  ) {
    return this.flights.updateCabin(user, id, cabinId, dto);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Get(':id/bookings')
  @ApiOperation({
    summary: 'Bookings of my flight and the seats remaining per cabin',
    description:
      'FLT-29, GEN-05. Confirmed and Cancelled bookings with reference, passenger names, cabin, seats and status (10 per page), plus seats remaining per cabin.',
  })
  @ApiResponse({ status: 200, description: 'Page of bookings and seatsRemaining per cabin' })
  @ApiResponse({ status: 400, description: 'Invalid page' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  listBookings(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.flights.listBookings(user, id, query.page);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Get(':id/passengers/export')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Download the passenger list of my flight as CSV',
    description: 'FLT-29. One row per passenger: reference, status, cabin, seats, name, type, passport, extra bags.',
  })
  @ApiResponse({ status: 200, description: 'CSV file' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not an airline moderator, or the flight belongs to another airline' })
  @ApiResponse({ status: 404, description: 'Flight not found' })
  async exportPassengers(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    const { fileName, csv } = await this.flights.passengersCsv(user, id);
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
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