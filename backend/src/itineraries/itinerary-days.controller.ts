import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryDaysService } from './itinerary-days.service';
import { AddDayDto, ReorderDayDto, UpdateDayDto } from './dto/day.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itinerary days')
@Controller('itineraries/:id/days')
export class ItineraryDaysController {
  constructor(private readonly days: ItineraryDaysService) {}

  @Auth(Role.USER)
  @Post()
  @ApiOperation({ summary: 'Add a day with a city. Maximum 60 days (ITN-05, ITN-09)' })
  @ApiResponse({ status: 201, description: 'Itinerary with the new day, dates and city groups' })
  @ApiResponse({ status: 400, description: 'Missing or unknown city, or more than 60 days' })
  @ApiResponse({ status: 404, description: 'Itinerary not found or not yours' })
  add(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: AddDayDto) {
    return this.days.add(user, id, dto);
  }

  // IMPORTANT: 'reorder' must be declared BEFORE ':dayId', otherwise "reorder" is read as a day id.
  @Auth(Role.USER)
  @Patch('reorder')
  @ApiOperation({ summary: 'Move a day to a new position; days, dates and groups are recalculated (ITN-08)' })
  @ApiResponse({ status: 200, description: 'Itinerary with renumbered days' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found' })
  reorder(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: ReorderDayDto) {
    return this.days.reorder(user, id, dto);
  }

  @Auth(Role.USER)
  @Patch(':dayId')
  @ApiOperation({ summary: 'Edit a day city or notes (ITN-05)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 400, description: 'Unknown city' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found' })
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: UpdateDayDto,
  ) {
    return this.days.update(user, id, dayId, dto);
  }

  @Auth(Role.USER)
  @Delete(':dayId')
  @ApiOperation({ summary: 'Delete a day; remaining days are renumbered (ITN-07)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string, @Param('dayId') dayId: string) {
    return this.days.remove(user, id, dayId);
  }
}