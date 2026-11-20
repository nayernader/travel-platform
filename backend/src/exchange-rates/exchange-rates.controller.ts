import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('Exchange rates')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly rates: ExchangeRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Latest cached rates and their date (ITN-18)' })
  async latest() {
    const d = await this.rates.latest();
    return { base: d?.base, rateDate: d?.rateDate, rates: d?.rates };
  }
}