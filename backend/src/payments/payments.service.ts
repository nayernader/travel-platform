import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { BookingPort } from './booking-port.service';
import { PoliciesService } from './policies.service';
import { STRIPE } from './stripe.provider';
import { CreatePaymentDto } from './dto/payment.dto';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class PaymentsService {
  private log = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private payments: Model<PaymentDocument>,
    @Inject(STRIPE) private stripe: Stripe,
    private readonly port: BookingPort,
    private readonly policies: PoliciesService,
  ) {}

  async create(user: UserDocument, dto: CreatePaymentDto) {
    const payable: any = await this.port.getPayable(dto.bookingType, dto.bookingId, user.id);

    if (!(await this.policies.hasAccepted(dto.bookingType, dto.bookingId))) {
      throw new ForbiddenException('Accept the provider policies before paying (PAY-02)');
    }

    const open = await this.payments.findOne({
      bookingType: dto.bookingType,
      bookingId: new Types.ObjectId(dto.bookingId),
      status: { $in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED] },
    });
    if (open) return this.retry(user, open.id);

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(payable.amount * 100),
      currency: String(payable.currency).toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { bookingType: dto.bookingType, bookingId: dto.bookingId },
    });

    const payment = await this.payments.create({
      user: user._id,
      bookingType: dto.bookingType,
      bookingId: new Types.ObjectId(dto.bookingId),
      stripePaymentIntentId: intent.id,
      amount: payable.amount,
      currency: payable.currency,
    });

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      amount: payable.amount,
      currency: payable.currency,
      status: payment.status,
    };
  }

  private async mine(user: UserDocument, id: string) {
    const p = await this.payments.findById(id);
    if (!p) throw new NotFoundException('Payment not found');
    if (p.user.toString() !== user.id) throw new ForbiddenException('Not your payment');
    return p;
  }

  async get(user: UserDocument, id: string) {
    const p = await this.mine(user, id);
    return {
      id: p.id,
      bookingType: p.bookingType,
      bookingId: p.bookingId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      failureMessage: p.failureMessage,
    };
  }

  async retry(user: UserDocument, id: string) {
    const p = await this.mine(user, id);
    if (p.status === PaymentStatus.SUCCEEDED) throw new ConflictException('Already paid');
    await this.port.getPayable(p.bookingType as any, p.bookingId.toString(), user.id);
    const intent = await this.stripe.paymentIntents.retrieve(p.stripePaymentIntentId);
    if (p.status === PaymentStatus.FAILED) {
      p.status = PaymentStatus.REQUIRES_PAYMENT;
      p.failureMessage = undefined;
      await p.save();
    }
    return {
      paymentId: p.id,
      clientSecret: intent.client_secret,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
    };
  }

  /** Called by the webhook controller with an event whose signature was already verified. */
  async handleEvent(event: Stripe.Event) {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const p = await this.payments.findOne({ stripePaymentIntentId: intent.id });
      if (!p || p.status === PaymentStatus.SUCCEEDED) return;
      p.status = PaymentStatus.SUCCEEDED;
      await p.save();
      const booking = await this.port.confirmPaid(p.bookingType as any, p.bookingId.toString(), intent.id);
      if (!booking) {
        this.log.warn(`Paid ${intent.id} but booking ${p.bookingId} is no longer pending`);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;
      await this.payments.updateOne(
        { stripePaymentIntentId: intent.id, status: { $ne: PaymentStatus.SUCCEEDED } },
        { status: PaymentStatus.FAILED, failureMessage: intent.last_payment_error?.message },
      );
    }
  }

  /** PAY-01: when the hold has expired the PaymentIntent is cancelled. */
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredIntents() {
    const open = await this.payments.find({
      status: { $in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED] },
      createdAt: { $lte: new Date(Date.now() - 10 * 60 * 1000) },
    });
    for (const p of open) {
      const booking: any = await this.port.get(p.bookingType as any, p.bookingId.toString()).catch(() => null);
      if (booking && booking.status === 'PENDING_PAYMENT') continue;
      try {
        await this.stripe.paymentIntents.cancel(p.stripePaymentIntentId);
      } catch {
        /* already final */
      }
      p.status = PaymentStatus.CANCELED;
      await p.save();
    }
  }
}