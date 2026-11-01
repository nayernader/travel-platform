import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReferenceDataService } from './reference-data.service';

@ApiTags('Reference data')
@Controller('reference')
export class ReferenceDataController {
  constructor(private readonly reference: ReferenceDataService) {}

  @Get('countries')
  @ApiOperation({ summary: 'List countries with their currency', description: 'GEN-12' })
  countries() {
    return this.reference.listCountries();
  }

  @Get('cities')
  @ApiOperation({ summary: 'List cities', description: 'GEN-12' })
  @ApiQuery({ name: 'countryCode', required: false, example: 'EG' })
  cities(@Query('countryCode') countryCode?: string) {
    return this.reference.listCities(countryCode);
  }

  @Get('airports')
  @ApiOperation({ summary: 'List airports with time zones', description: 'FLT-02, GEN-12' })
  @ApiQuery({ name: 'cityId', required: false, example: 'cairo' })
  airports(@Query('cityId') cityId?: string) {
    return this.reference.listAirports(cityId);
  }

  @Get('attractions')
  @ApiOperation({ summary: 'List attractions', description: 'GEN-12' })
  @ApiQuery({ name: 'cityId', required: false, example: 'cairo' })
  attractions(@Query('cityId') cityId?: string) {
    return this.reference.listAttractions(cityId);
  }
}