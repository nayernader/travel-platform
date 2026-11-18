import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItinerarySharingService } from './itinerary-sharing.service';
import { SearchPublicItinerariesDto } from './dto/public-search.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

// Registered BEFORE ItinerariesController in the module, so "public" is never read as an :id.
@ApiTags('Public itineraries')
@Controller('itineraries/public')
export class PublicItinerariesController {
  constructor(private readonly sharing: ItinerarySharingService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search public itineraries by keyword, country, city and duration, 10 per page (ITN-20, ITN-21)',
    description: 'No login needed. Hidden itineraries and itineraries of deactivated users are never listed.',
  })
  @ApiResponse({ status: 200, description: 'Page of public itineraries (empty items when nothing matches)' })
  @ApiResponse({ status: 400, description: 'Invalid filter, or minDays greater than maxDays' })
  search(@Query() q: SearchPublicItinerariesDto) {
    return this.sharing.search(q);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'View a public itinerary read-only: author, days, activities and budget entries (ITN-21)',
    description: 'No login needed.',
  })
  @ApiResponse({ status: 200, description: 'Public itinerary' })
  @ApiResponse({ status: 404, description: 'Not found, private, hidden, or its owner deactivated the account' })
  view(@Param('id') id: string) {
    return this.sharing.view(id);
  }
}

@ApiTags('Public itineraries')
@Controller('itineraries')
export class ItineraryCloneController {
  constructor(private readonly sharing: ItinerarySharingService) {}

  @Auth(Role.USER)
  @Post(':id/clone')
  @ApiOperation({
    summary: 'Clone a public itinerary into my account: private, independent copy crediting the author (ITN-21)',
  })
  @ApiResponse({ status: 201, description: 'The new private itinerary' })
  @ApiResponse({ status: 404, description: 'Not found, private, hidden, or its owner deactivated the account' })
  clone(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.sharing.clone(user, id);
  }
}