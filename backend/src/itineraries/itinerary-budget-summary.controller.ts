import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryBudgetSummaryService } from './itinerary-budget-summary.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itinerary budgets')
@Controller('itineraries')
export class ItineraryBudgetSummaryController {
  constructor(private readonly summary: ItineraryBudgetSummaryService) {}

  @Auth(Role.USER)
  @Get(':id/budget-summary')
  @ApiOperation({
    summary: 'Budget totals by category, by day and by city group, in my preferred currency (ITN-14, ITN-18)',
    description:
      'Budget entries, activity costs (under Activities) and intercity transport costs are converted with the ' +
      'cached daily exchange rates. The response shows the rate date. Booking prices are not converted.',
  })
  @ApiResponse({ status: 200, description: 'Totals with currency and rateDate' })
  @ApiResponse({ status: 404, description: 'Itinerary not found, or not yours' })
  summaryOf(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.summary.summary(user, id);
  }
}

