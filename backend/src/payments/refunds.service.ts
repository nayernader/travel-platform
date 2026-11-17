import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { Refund, RefundDocument, RefundStatus } from './schemas/refund.schema';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { STRIPE } from './stripe.provider';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';

const toStatus = (s?: string | null) =>
  s === 'succeeded' ? RefundStatus.REFUNDED : s === 'failed' || s === 'canceled' ? RefundStatus.FAILED : RefundStatus.PENDING;

@Injectable()
export class RefundsService {
  private log = new Logger(RefundsService.name);

  constructor(
    @InjectModel(Refund.name) private refunds: Model<RefundDocument>,
    @InjectModel(Payment.name) private payments: Model<PaymentDocument>,
    @Inject(STRIPE) private stripe: Stripe,
    private readonly notifications: NotificationsService,
  ) {}

  /** Cancellation events from flights (amount + paymentId) and hotels (type + bookingId + percent). */
  @OnEvent('booking.refund.requested')
  async onRefundRequested(e: any) {
    try {
      let payment: PaymentDocument | null = null;
      if (e.paymentId) {
        payment = await this.payments.findOne({ stripePaymentIntentId: e.paymentId });
      } else if (e.bookingId && e.type) {
        payment = await this.payments.findOne({
          bookingType: e.type,
          bookingId: new Types.ObjectId(String(e.bookingId)),
          status: PaymentStatus.SUCCEEDED,
        });
      }
      if (!payment) {
        this.log.warn(`No payment found for refund event ${JSON.stringify(e)}`);
        return;
      }
      const amount = e.amount ?? (payment.amount * Number(e.percent ?? 0)) / 100;
      await this.refundNow(payment, Math.round(amount * 100) / 100);
    } catch (err) {
      this.log.error(`Refund failed: ${(err as Error).message}`);
    }
  }

  /** Creates the refund record and calls Stripe. A second call for the same booking does nothing. */
  async refundNow(payment: PaymentDocument, amount: number) {
    if (amount <= 0) return null;
    let record: RefundDocument;
    try {
      record = await this.refunds.create({
        user: payment.user,
        bookingType: payment.bookingType,
        bookingId: payment.bookingId,
        amount,
        currency: payment.currency,
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        return this.refunds.findOne({ bookingType: payment.bookingType, bookingId: payment.bookingId });
      }
      throw e;
    }
    try {
      const r = await this.stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(amount * 100),
      });
      record.stripeRefundId = r.id;
      record.status = toStatus(r.status);
    } catch (err) {
      record.status = RefundStatus.FAILED;
      record.failureReason = (err as Error).message;
    }
    await record.save();
    await this.notifications.notify(
      payment.user as any,
      NotificationType.REFUND_UPDATED,
      `Refund ${record.status.toLowerCase()}`,
      { bookingId: String(payment.bookingId), amount, status: record.status },
    );
    return record;
  }

  /** Stripe tells us when a pending refund finished or failed. */
  async syncFromStripe(r: Stripe.Refund) {
    const rec = await this.refunds.findOne({ stripeRefundId: r.id });
    if (!rec) return;
    rec.status = toStatus(r.status);
    await rec.save();
    await this.notifications.notify(
      rec.user as any,
      NotificationType.REFUND_UPDATED,
      `Refund ${rec.status.toLowerCase()}`,
      { bookingId: String(rec.bookingId), status: rec.status },
    );
  }

  async get(user: UserDocument, id: string) {
    const r = await this.refunds.findById(id);
    if (!r) throw new NotFoundException('Refund not found');
    if (r.user.toString() !== user.id) throw new ForbiddenException('Not your refund');
    return r;
  }

  forBooking(type: string, bookingId: string) {
    return this.refunds.findOne({ bookingType: type, bookingId: new Types.ObjectId(bookingId) });
  }
}