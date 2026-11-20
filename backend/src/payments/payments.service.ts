
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import {
  Payment,
  PaymentDocument,
  PaymentPurpose,
  PaymentStatus,
} from './schemas/payment.schema';
import { BookingPort } from './booking-port.service';
import { PoliciesService } from './policies.service';
import { STRIPE } from './stripe.provider';
import { CreatePaymentDto } from './dto/payment.dto';
import type { UserDocument } from '../users/schemas/user.schema';
import { RefundsService } from './refunds.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

@Injectable()
export class PaymentsService {
  private readonly log = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private payments: Model<PaymentDocument>,
    @Inject(STRIPE) private stripe: Stripe,
    private readonly port: BookingPort,
    private readonly policies: PoliciesService,
    private readonly refunds: RefundsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: UserDocument, dto: CreatePaymentDto) {
    const payable: any = await this.port.getPayable(
      dto.bookingType,
      dto.bookingId,
      user.id,
    );

    if (!(await this.policies.hasAccepted(dto.bookingType, dto.bookingId))) {
      throw new ForbiddenException(
        'Accept the provider policies before paying (PAY-02)',
      );
    }

    const bookingId = new Types.ObjectId(dto.bookingId);
    const open = await this.payments.findOne({
      bookingType: dto.bookingType,
      bookingId,
      purpose: PaymentPurpose.INITIAL_BOOKING,
      status: {
        $in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED],
      },
    });

    if (open) return this.retry(user, open.id);

    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(payable.amount * 100),
      currency: String(payable.currency).toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        bookingType: dto.bookingType,
        bookingId: dto.bookingId,
        purpose: PaymentPurpose.INITIAL_BOOKING,
      },
    });

    const payment = await this.payments.create({
      user: user._id,
      bookingType: dto.bookingType,
      bookingId,
      stripePaymentIntentId: intent.id,
      amount: payable.amount,
      currency: payable.currency,
      purpose: PaymentPurpose.INITIAL_BOOKING,
    });

    return this.paymentResponse(payment, intent);
  }

  async createFlightChange(
    user: UserDocument,
    bookingId: string,
    changeId: string,
  ) {
    const payable = await this.port.getFlightChangePayable(
      bookingId,
      changeId,
      user.id,
    );

    if (payable.amount <= 0) {
      throw new ConflictException(
        'This flight change does not require an additional payment',
      );
    }

    const existing = await this.payments.findOne({
      bookingType: 'flight',
      bookingId: new Types.ObjectId(bookingId),
      purpose: PaymentPurpose.FLIGHT_CHANGE,
      changeId,
      status: {
        $in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED],
      },
    });

    if (existing) return this.retry(user, existing.id);

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(payable.amount * 100),
        currency: String(payable.currency).toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          bookingType: 'flight',
          bookingId,
          purpose: PaymentPurpose.FLIGHT_CHANGE,
          changeId,
        },
      },
      {
        idempotencyKey: `flight-change-${bookingId}-${changeId}`,
      },
    );

    const payment = await this.payments.create({
      user: user._id,
      bookingType: 'flight',
      bookingId: new Types.ObjectId(bookingId),
      stripePaymentIntentId: intent.id,
      amount: payable.amount,
      currency: payable.currency,
      purpose: PaymentPurpose.FLIGHT_CHANGE,
      changeId,
    });

    return this.paymentResponse(payment, intent);
  }

  private paymentResponse(
    payment: PaymentDocument,
    intent: Stripe.PaymentIntent,
  ) {
    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    };
  }

  private async mine(user: UserDocument, id: string) {
    const payment = await this.payments.findById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.user.toString() !== user.id) {
      throw new ForbiddenException('Not your payment');
    }
    return payment;
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

    if (p.status === PaymentStatus.SUCCEEDED) {
      throw new ConflictException('Already paid');
    }

    if (p.status === PaymentStatus.CANCELED) {
      throw new ConflictException('Payment has been canceled');
    }

    if (p.purpose === PaymentPurpose.FLIGHT_CHANGE) {
      await this.port.getFlightChangePayable(
        p.bookingId.toString(),
        p.changeId!,
        user.id,
      );
    } else {
      await this.port.getPayable(
        p.bookingType as any,
        p.bookingId.toString(),
        user.id,
      );
    }

    const intent = await this.stripe.paymentIntents.retrieve(
      p.stripePaymentIntentId,
    );

    if (intent.status === 'canceled') {
      throw new ConflictException('PaymentIntent has been canceled');
    }

    if (p.status === PaymentStatus.FAILED) {
      p.status = PaymentStatus.REQUIRES_PAYMENT;
      p.failureMessage = undefined;
      await p.save();
    }

    return this.paymentResponse(p, intent);
  }

  /** Called only after the webhook signature has been verified. */
  async handleEvent(event: Stripe.Event) {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const p = await this.payments.findOne({
        stripePaymentIntentId: intent.id,
      });

      if (!p || p.status === PaymentStatus.SUCCEEDED) return;

      if (p.purpose === PaymentPurpose.FLIGHT_CHANGE) {
        if (!p.changeId) {
          this.log.error(`Flight-change payment ${p.id} has no changeId`);
          await this.refunds.refundFlightChange(p, p.amount, 'unknown');
          return;
        }

        const applied = await this.port.completeFlightChangePayment(
          p.bookingId.toString(),
          p.changeId,
        );

        p.status = PaymentStatus.SUCCEEDED;
        await p.save();

        if (!applied) {
          this.log.warn(
            `Flight change ${p.changeId} could not be applied; refunding ${intent.id}`,
          );
          await this.refunds.refundFlightChange(
            p,
            p.amount,
            p.changeId,
          );
          await this.notifications.notify(
            p.user as any,
            NotificationType.FLIGHT_CHANGE_FAILED,
            `Your flight change could not be applied and your payment of ${p.amount} ${p.currency} will be refunded.`,
            { bookingId: p.bookingId.toString(), changeId: p.changeId },
          );
        } else {
          await this.notifications.notify(
            p.user as any,
            NotificationType.FLIGHT_CHANGE_APPLIED,
            `Your flight change has been confirmed. Payment of ${p.amount} ${p.currency} received.`,
            { bookingId: p.bookingId.toString(), changeId: p.changeId },
          );
        }

        return;
      }

      const booking = await this.port.confirmPaid(
        p.bookingType as any,
        p.bookingId.toString(),
        intent.id,
      );

      p.status = PaymentStatus.SUCCEEDED;
      await p.save();

      if (!booking) {
        this.log.warn(
          `Paid ${intent.id} but booking ${p.bookingId} is no longer pending; refunding`,
        );
        await this.refunds.refundNow(p, p.amount);
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as Stripe.PaymentIntent;

      await this.payments.updateOne(
        {
          stripePaymentIntentId: intent.id,
          status: { $nin: [PaymentStatus.SUCCEEDED, PaymentStatus.CANCELED] },
        },
        {
          status: PaymentStatus.FAILED,
          failureMessage: intent.last_payment_error?.message,
        },
      );
    } else if (event.type === 'refund.updated') {
      await this.refunds.syncFromStripe(
        event.data.object as Stripe.Refund,
      );
    }
  }

  /** Cancel stale payment intents and release expired flight-change holds. */
  @Cron(CronExpression.EVERY_MINUTE)
  async cancelExpiredIntents() {
    const open = await this.payments.find({
      status: {
        $in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED],
      },
      createdAt: {
        $lte: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    for (const p of open) {
      if (p.purpose === PaymentPurpose.FLIGHT_CHANGE) {
        if (p.changeId) {
          await this.port
            .failFlightChange(p.bookingId.toString(), p.changeId)
            .catch((err) =>
              this.log.warn(
                `Could not expire flight change ${p.changeId}: ${err}`,
              ),
            );
        }
      } else {
        const booking: any = await this.port
          .get(p.bookingType as any, p.bookingId.toString())
          .catch(() => null);

        if (booking?.status === 'PENDING_PAYMENT') continue;
      }

      try {
        const intent = await this.stripe.paymentIntents.retrieve(
          p.stripePaymentIntentId,
        );

        if (intent.status === 'requires_payment_method' ||
            intent.status === 'requires_confirmation' ||
            intent.status === 'requires_action' ||
            intent.status === 'requires_capture') {
          await this.stripe.paymentIntents.cancel(intent.id);
        }
      } catch (err) {
        this.log.warn(`Could not cancel PaymentIntent ${p.stripePaymentIntentId}: ${err}`);
      }

      p.status = PaymentStatus.CANCELED;
      await p.save();
    }
  }
}
