import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AirlinesService } from './airlines.service';
import { CreateAirlineDto, UpdateAirlineDto } from './dto/create-airline.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { isValidObjectId } from 'mongoose';
import { BadRequestException } from '@nestjs/common';
import { ListAirlinesQueryDto } from './dto/list-airlines-query.dto';

@ApiTags('Airlines')
@Controller('airlines')

export class AirlinesController {
  
  constructor(private readonly airlines: AirlinesService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'FLT-01: create an airline profile (admin)' })
  create(@Body() dto: CreateAirlineDto) {
    return this.airlines.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List active airlines (paginated, searchable by name or code)' })
  findAll(@Query() query: ListAirlinesQueryDto) {
    return this.airlines.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'FLT-01: view an airline profile' })
  findOne(@Param('id') id: string) {
    return this.airlines.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN, Role.AIRLINE_MODERATOR)
  @ApiOperation({ summary: 'FLT-01: edit an airline profile (its own moderator or admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateAirlineDto, @CurrentUser() user: UserDocument) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid airline id');
    return this.airlines.update(id, dto, user);
  }
}