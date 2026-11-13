import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { HotelSearchService } from './hotel-search.service';
import { SearchHotelsDto } from './dto/search-hotels.dto';

@ApiTags('Hotels')
@Controller('hotels')
export class HotelSearchController {
  constructor(
    private readonly search: HotelSearchService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary:
      'Public hotel search with free rooms, filters and sorting (HTL-11, HTL-12)',
  })
  find(@Query() dto: SearchHotelsDto) {
    return this.search.search(dto);
  }

  @Get(':id/rooms/available')
  @ApiOperation({
    summary:
      'Rooms free for the dates with total stay price (HTL-15)',
  })
  @ApiQuery({
    name: 'checkIn',
    example: '2026-12-20',
  })
  @ApiQuery({
    name: 'checkOut',
    example: '2026-12-23',
  })
  @ApiQuery({
    name: 'guests',
    required: false,
  })
  available(
    @Param('id') id: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
    @Query('guests') guests?: string,
  ) {
    return this.search.availableRooms(
      id,
      checkIn,
      checkOut,
      guests ? Number(guests) : undefined,
    );
  }
}