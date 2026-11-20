import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type RefundDocument = HydratedDocument<Refund>;

export enum RefundStatus {
  PENDING = 'PENDING',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

export enum RefundPurpose {
  CANCELLATION = 'CANCELLATION',
  FLIGHT_CHANGE = 'FLIGHT_CHANGE',
}

@Schema({ timestamps: true })
export class Refund {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true, enum: ['flight', 'hotel'] })
  bookingType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  bookingId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop()
  stripeRefundId?: string;

  @Prop({ enum: Object.values(RefundStatus), default: RefundStatus.PENDING })
  status: RefundStatus;

  @Prop()
  failureReason?: string;

  @Prop({
    type: String,
    enum: RefundPurpose,
    default: RefundPurpose.CANCELLATION,
    required: true,
  })
  purpose: RefundPurpose;

  @Prop({ type: String, trim: true, index: true })
  changeId?: string;
}


export const RefundSchema = SchemaFactory.createForClass(Refund);

RefundSchema.index(
  { bookingType: 1, bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purpose: RefundPurpose.CANCELLATION,
    },
  },
);

RefundSchema.index(
  { bookingType: 1, bookingId: 1, changeId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      purpose: RefundPurpose.FLIGHT_CHANGE,
      changeId: { $type: 'string' },
    },
  },
);