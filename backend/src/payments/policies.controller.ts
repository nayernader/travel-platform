import { Controller, Get, Param, ParseEnumPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PoliciesService } from './policies.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auth } from '../auth/decorators/auth.decorator';

enum BookingTypeParam {
  flight = 'flight',
  hotel = 'hotel',
}

@ApiTags('Payments')
@Controller('bookings/:type/:id')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Auth()
  @Get('policies')
  @ApiParam({ name: 'type', enum: BookingTypeParam })
  @ApiOperation({ summary: 'Provider policies shown before payment (PAY-02)' })
  get(
    @CurrentUser() user: UserDocument,
    @Param('type', new ParseEnumPipe(BookingTypeParam)) type: BookingTypeParam,
    @Param('id') id: string,
  ) {
    return this.policies.getPolicies(user, type, id);
  }

  @Auth()
  @Post('accept-policies')
  @ApiParam({ name: 'type', enum: BookingTypeParam })
  @ApiOperation({ summary: 'Accept the policies, stored with a timestamp (PAY-02)' })
  accept(
    @CurrentUser() user: UserDocument,
    @Param('type', new ParseEnumPipe(BookingTypeParam)) type: BookingTypeParam,
    @Param('id') id: string,
  ) {
    return this.policies.accept(user, type, id);
  }
}