import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ItineraryBudgetsService } from './itinerary-budgets.service';
import { CreateBudgetDto, CreateTransportCostDto, UpdateBudgetDto, UpdateTransportCostDto } from './dto/budget.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/enums/role.enum';

@ApiTags('Itinerary budgets')
@Controller('itineraries/:id')
export class ItineraryBudgetRoutesController {
  constructor(private readonly budgets: ItineraryBudgetsService) {}

  @Auth(Role.USER)
  @Post('days/:dayId/budgets')
  @ApiOperation({ summary: 'Add a budget entry to a day: category, amount, currency (ITN-14)' })
  @ApiResponse({ status: 201, description: 'Itinerary with the new budget entry' })
  @ApiResponse({ status: 400, description: 'Invalid category, negative amount or unsupported currency' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found, or not yours' })
  addBudget(
    @CurrentUser() user: UserDocument,
    @Param('id') id: string,
    @Param('dayId') dayId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgets.addBudget(user, id, dayId, dto);
  }

  @Auth(Role.USER)
  @Post('transport-costs')
  @ApiOperation({ summary: 'Add an intercity transport cost to a day: mode, from, to, amount, currency (ITN-16)' })
  @ApiResponse({ status: 201, description: 'Itinerary with the new transport cost' })
  @ApiResponse({ status: 400, description: 'Invalid input, unknown city, or same from and to city' })
  @ApiResponse({ status: 404, description: 'Itinerary or day not found, or not yours' })
  addTransport(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: CreateTransportCostDto) {
    return this.budgets.addTransport(user, id, dto);
  }
}

@ApiTags('Itinerary budgets')
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgets: ItineraryBudgetsService) {}

  @Auth(Role.USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a budget entry (ITN-14)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 404, description: 'Budget entry not found, or not yours' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.budgets.updateBudget(user, id, dto);
  }

  @Auth(Role.USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a budget entry (ITN-14)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Budget entry not found, or not yours' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.budgets.removeBudget(user, id);
  }
}

@ApiTags('Itinerary budgets')
@Controller('transport-costs')
export class TransportCostsController {
  constructor(private readonly budgets: ItineraryBudgetsService) {}

  @Auth(Role.USER)
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a transport cost, or move it to another day with dayId (ITN-16)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 400, description: 'Invalid input, unknown city, or same from and to city' })
  @ApiResponse({ status: 404, description: 'Transport cost or target day not found, or not yours' })
  update(@CurrentUser() user: UserDocument, @Param('id') id: string, @Body() dto: UpdateTransportCostDto) {
    return this.budgets.updateTransport(user, id, dto);
  }

  @Auth(Role.USER)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transport cost (ITN-16)' })
  @ApiResponse({ status: 200, description: 'Updated itinerary' })
  @ApiResponse({ status: 404, description: 'Transport cost not found, or not yours' })
  remove(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.budgets.removeTransport(user, id);
  }
}