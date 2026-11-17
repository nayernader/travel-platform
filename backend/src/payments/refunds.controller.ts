import { Controller, ForbiddenException, Get, Param, ParseEnumPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auth } from '../auth/decorators/auth.decorator';

enum TypeParam {
  flight = 'flight',
  hotel = 'hotel',
}

@ApiTags('Refunds')
@Controller()
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Auth()
  @Get('refunds/:id')
  @ApiOperation({ summary: 'Refund status: PENDING, REFUNDED or FAILED (PAY-03)' })
  get(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.refunds.get(user, id);
  }

  @Auth()
  @Get('bookings/:type/:id/refund')
  @ApiParam({ name: 'type', enum: TypeParam })
  @ApiOperation({ summary: 'Refund of one of my bookings, for the booking details page (PAY-03)' })
  async forBooking(
    @CurrentUser() user: UserDocument,
    @Param('type', new ParseEnumPipe(TypeParam)) type: TypeParam,
    @Param('id') id: string,
  ) {
    const r = await this.refunds.forBooking(type, id);
    if (r && r.user.toString() !== user.id) throw new ForbiddenException('Not your refund');
    return r ?? { status: 'NONE' };
  }
}