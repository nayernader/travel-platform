import {
  BadRequestException, Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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