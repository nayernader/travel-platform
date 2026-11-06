
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { FlightsService } from './flights.service';
import { CreateFlightDto } from './dto/create-flight.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Auth(Role.AIRLINE_MODERATOR)
  @Post()
  @ApiOperation({
    summary: 'Create a flight for my airline (FLT-03). Times are LOCAL, stored in UTC.',
  })
  create(
    @CurrentUser() user: UserDocument,
    @Body() dto: CreateFlightDto,
  ) {
    return this.flights.create(user, dto);
  }

  // Member 3 adds GET /flights/search ABOVE this route.
  // Keep ":id" routes at the bottom.
  @Get(':id')
  @ApiOperation({
    summary: 'Flight details with local times (FLT-17 uses this)',
  })
  findOne(@Param('id') id: string) {
    return this.flights.findOneView(id);
  }
}
