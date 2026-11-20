import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItinerarySuggestionsService } from './itinerary-suggestions.service';
import { ItineraryFlightsQueryDto, ItineraryHotelsQueryDto } from './dto/suggestions.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itinerary suggestions')
@Controller('itineraries/:id')
export class ItinerarySuggestionsController {
  constructor(private readonly suggestions: ItinerarySuggestionsService) {}

  @Auth(Role.USER)
  @Get('hotels')
  @ApiOperation({
    summary: 'Hotels available for one city group of my itinerary (ITN-25)',
    description:
      'Check-in is the date of the group\'s first day, check-out the day after its last day. ' +
      'Guests, rooms and filters work like the normal hotel search.',
  })
  @ApiResponse({ status: 200, description: 'The group (city, dates) and a page of hotels' })
  @ApiResponse({ status: 400, description: 'Unknown group number, missing guests, or dates in the past' })
  @ApiResponse({ status: 404, description: 'Itinerary not found, or not yours' })
  hotels(@CurrentUser() user: UserDocument, @Param('id') id: string, @Query() q: ItineraryHotelsQueryDto) {
    return this.suggestions.hotels(user, id, q);
  }

  @Auth(Role.USER)
  @Get('flights')
  @ApiOperation({
    summary: 'Flights from my origin airport to the city of the first day, one-way or round trip (ITN-26)',
    description:
      'Outbound date defaults to the start date, return date to the date of the last day. ' +
      'One result per airport in the destination city.',
  })
  @ApiResponse({ status: 200, description: 'Flights per destination airport' })
  @ApiResponse({ status: 400, description: 'No days yet, unknown origin airport, or invalid dates' })
  @ApiResponse({ status: 404, description: 'Itinerary not found, or not yours' })
  flights(@CurrentUser() user: UserDocument, @Param('id') id: string, @Query() q: ItineraryFlightsQueryDto) {
    return this.suggestions.flights(user, id, q);
  }
}
