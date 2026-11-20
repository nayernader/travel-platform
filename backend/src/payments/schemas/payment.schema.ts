import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export enum PaymentStatus {
  REQUIRES_PAYMENT = 'REQUIRES_PAYMENT',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum PaymentPurpose {
  INITIAL_BOOKING = 'INITIAL_BOOKING',
  FLIGHT_CHANGE = 'FLIGHT_CHANGE',
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

  @Prop({
    type: String,
    enum: PaymentPurpose,
    default: PaymentPurpose.INITIAL_BOOKING,
    required: true,
  })
  purpose: PaymentPurpose;

  @Prop({ type: String, trim: true, index: true })
  changeId?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index(
  { bookingId: 1, changeId: 1, purpose: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purpose: PaymentPurpose.FLIGHT_CHANGE,
      changeId: { $type: 'string' },
    },
  },
);