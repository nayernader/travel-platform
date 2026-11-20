import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { STRIPE } from './stripe.provider';
import { CreatePaymentDto } from './dto/payment.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Auth } from '../auth/decorators/auth.decorator';
import { RequireVerifiedEmail } from '../auth/decorators/require-verified-email.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, @Inject(STRIPE) private stripe: Stripe) {}

  @Auth()
  @RequireVerifiedEmail()
  @Post()
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for my Pending Payment booking (PAY-01)' })
  create(@CurrentUser() user: UserDocument, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, dto);
  }

  /** NO @Auth: Stripe calls this. The signature is the protection. */
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Stripe webhook: the ONLY place a booking becomes Confirmed (PAY-01)' })
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
    await this.payments.handleEvent(event);
    return { received: true };
  }

  @Auth()
  @RequireVerifiedEmail()
  @Post('flight-change/:bookingId/:changeId')
  @ApiOperation({
    summary: 'Pay the fare difference for a pending flight booking change (FLT-27)',
    description:
      'Creates a Stripe PaymentIntent for the extra fare owed when changing to a more expensive flight. ' +
      'Only valid while the pending change is in PENDING_PAYMENT status and has not expired. ' +
      'Returns the clientSecret to complete payment on the client. ' +
      'Calling again while a REQUIRES_PAYMENT or FAILED intent already exists re-uses it (idempotent).',
  })
  @ApiParam({ name: 'bookingId', description: 'The confirmed flight booking to change' })
  @ApiParam({ name: 'changeId', description: 'The changeId returned by POST /flight-bookings/:id/change' })
  @ApiResponse({ status: 201, description: 'PaymentIntent clientSecret, amount and currency' })
  @ApiResponse({ status: 401, description: 'Not logged in' })
  @ApiResponse({ status: 403, description: 'Not the booking owner or email not verified' })
  @ApiResponse({ status: 404, description: 'Booking or change not found' })
  @ApiResponse({ status: 409, description: 'Change does not need payment, has expired, or is already applied' })
  createFlightChange(
    @CurrentUser() user: UserDocument,
    @Param('bookingId') bookingId: string,
    @Param('changeId') changeId: string,
  ) {
    return this.payments.createFlightChange(user, bookingId, changeId);
  }

  @Auth()
  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry after a failed payment until the hold expires (PAY-01)' })
  retry(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.payments.retry(user, id);
  }

  @Auth()
  @Get(':id')
  @ApiOperation({ summary: 'My payment status (PAY-01)' })
  get(@CurrentUser() user: UserDocument, @Param('id') id: string) {
    return this.payments.get(user, id);
  }
}