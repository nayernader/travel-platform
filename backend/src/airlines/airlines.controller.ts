import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AirlinesService } from './airlines.service';
import { CreateAirlineDto, UpdateAirlineDto } from './dto/create-airline.dto';
import { BaggagePolicyDto } from './dto/baggage-policy.dto';

import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@ApiTags('Airlines')
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlines: AirlinesService) {}

  @Auth(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Admin creates an airline profile (FLT-01)' })
  create(@Body() dto: CreateAirlineDto) {
    return this.airlines.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Public airline profile' })
  findOne(@Param('id') id: string) {
    return this.airlines.findOne(id);
  }

  @Auth(Role.ADMIN, Role.AIRLINE_MODERATOR)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit airline name, description or logo (FLT-01)' })
  update(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: UpdateAirlineDto,
  ) {
    return this.airlines.update(user, id, dto);
  }

  @Auth(Role.AIRLINE_MODERATOR)
  @Put(':id/baggage-policy')
  @ApiOperation({ summary: 'Set extra-bag price and max extra bags (FLT-08)' })
  setBaggage(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Body() dto: BaggagePolicyDto,
  ) {
    return this.airlines.setBaggagePolicy(user, id, dto);
  }
}