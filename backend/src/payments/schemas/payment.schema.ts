import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  REQUIRES_PAYMENT = 'REQUIRES_PAYMENT',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, enum: ['flight', 'hotel'] })
  bookingType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  stripePaymentIntentId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ enum: Object.values(PaymentStatus), default: PaymentStatus.REQUIRES_PAYMENT })
  status: PaymentStatus;

  @Prop()
  failureMessage?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);