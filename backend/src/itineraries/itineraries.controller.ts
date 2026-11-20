import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItinerariesService } from './itineraries.service';
import { CreateItineraryDto, UpdateItineraryDto } from './dto/itinerary.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Itineraries')
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly its: ItinerariesService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({ summary: 'Create an itinerary, private by default (ITN-01)' })
  @ApiResponse({ status: 201, description: 'Itinerary created' })
  @ApiResponse({ status: 400, description: 'Invalid title, countries or start date' })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreateItineraryDto) {
    return this.its.create(user, dto);
  }

  @Auth(Role.USER)
  @Get()
  @ApiOperation({ summary: 'My itineraries, most recently updated first, 10 per page (ITN-03)' })
  @ApiResponse({ status: 200, description: 'Page of my itineraries' })
  mine(@CurrentUser() user: UserDocument, @Query() q: PaginationQueryDto) {
    return this.its.listMine(user, q.page);
  }

  // IMPORTANT: later branches register the 'public/...' routes in a SEPARATE controller BEFORE this one,
  // otherwise "public" would be read as an :id.
  @Auth(Role.USER)
  @Get(':id')
  @ApiOperation({ summary: 'Full itinerary with day dates and city groups (ITN-03)' })
  @ApiResponse({ status: 200, description: 'Itinerary details' })
  @ApiResponse({ status: 404, description: 'Not found, or not your itinerary' })
  one(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.its.findMine(user, id);
  }

  @Auth(Role.USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit title, countries and start date (ITN-01)' })
  @ApiResponse({ status: 200, description: 'Itinerary updated' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Not found, or not your itinerary' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateItineraryDto) {
    return this.its.update(user, id, dto);
  }

  @Auth(Role.USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete my itinerary (ITN-01). The frontend asks for confirmation first.' })
  @ApiResponse({ status: 200, description: '{ deleted: true }' })
  @ApiResponse({ status: 404, description: 'Not found, or not your itinerary' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.its.remove(user, id);
  }
}