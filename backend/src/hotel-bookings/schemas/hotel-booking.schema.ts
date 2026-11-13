import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

import { BookingStatus } from '../../common/enums/booking-status.enum';

export type HotelBookingDocument = HydratedDocument<HotelBooking>;

@Schema({ _id: false })
export class BookedRoom {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Room',
    required: true,
  })
  room: Types.ObjectId;

  @Prop({ required: true })
  pricePerNight: number; // price at booking time (HTL-16)

  @Prop({ required: true, min: 1 })
  adults: number;

  @Prop({ type: [Number], default: [] })
  childAges: number[]; // 0-17
}

@Schema({ timestamps: true })
export class HotelBooking {
  @Prop({ unique: true, sparse: true })
  reference?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true,
  })
  hotel: Types.ObjectId;

  @Prop({ type: [BookedRoom], required: true })
  rooms: BookedRoom[];

  @Prop({ type: Date, required: true })
  checkIn: Date;

  @Prop({ type: Date, required: true })
  checkOut: Date;

  @Prop({ required: true })
  nights: number;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ default: 'USD' })
  currency: string; // PAY-04

  @Prop({
    enum: Object.values(BookingStatus),
    default: BookingStatus.PENDING_PAYMENT,
    index: true,
  })
  status: BookingStatus;

  @Prop({ type: Date, index: true })
  holdExpiresAt?: Date;

  @Prop()
  paymentId?: string;

  @Prop()
  cancelledBy?: string;

  @Prop()
  refundPercent?: number;

  @Prop()
  cancelledAt?: Date;
}

export const HotelBookingSchema =
  SchemaFactory.createForClass(HotelBooking);