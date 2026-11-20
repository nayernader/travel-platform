
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { BookingStatus } from '../../common/enums/booking-status.enum';
import { CabinClass } from '../../flights/schemas/flight.schema';

export type FlightBookingDocument = HydratedDocument<FlightBooking>;

export enum PassengerType {
  ADULT = 'ADULT', // 12+
  CHILD = 'CHILD', // 2 to 11
  INFANT = 'INFANT', // under 2, no seat
}

export enum FlightChangeStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_REFUND = 'PENDING_REFUND',
}

export enum CancelledBy {
  USER = 'USER',
  AIRLINE = 'AIRLINE',
}

@Schema({ _id: false })
export class Segment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flight: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(CabinClass) })
  cabinClass: CabinClass;

  // Agreed price per adult/child seat.
  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

@Schema({ _id: false })
export class Passenger {
  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ type: Date, required: true })
  dateOfBirth: Date;

  @Prop({ required: true, trim: true })
  passportNumber: string;

  @Prop({ required: true, enum: Object.values(PassengerType) })
  type: PassengerType;

  @Prop({ default: 0, min: 0 })
  extraBags: number;

  @Prop({ default: 0, min: 0 })
  extraBagWeightKg: number;
}

@Schema({ _id: false })
export class PendingFlightChangeSegment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flight: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(CabinClass) })
  cabinClass: CabinClass;

  @Prop({ required: true, min: 0 })
  unitPrice: number;
}

export const PendingFlightChangeSegmentSchema =
  SchemaFactory.createForClass(PendingFlightChangeSegment);

@Schema({ _id: false })
export class PendingFlightChange {
  @Prop({ required: true })
  changeId: string;

  @Prop({ type: [PendingFlightChangeSegmentSchema], required: true })
  segments: PendingFlightChangeSegment[];

  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @Prop({ required: true })
  fareDifference: number;

  @Prop({
    required: true,
    enum: Object.values(FlightChangeStatus),
  })
  status: FlightChangeStatus;

  @Prop()
  expiresAt?: Date;
}

export const PendingFlightChangeSchema =
  SchemaFactory.createForClass(PendingFlightChange);

@Schema({ timestamps: true })
export class FlightBooking {
  @Prop({ unique: true, sparse: true })
  reference?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user: Types.ObjectId;

  @Prop({ type: [Segment], required: true })
  segments: Segment[];

  @Prop({ type: [Passenger], required: true })
  passengers: Passenger[];

  @Prop({ required: true, min: 1 })
  seats: number;

  @Prop({ required: true, min: 0 })
  totalPrice: number;

  @Prop({ default: 'USD' })
  currency: string;

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

  @Prop({ enum: Object.values(CancelledBy) })
  cancelledBy?: CancelledBy;

  @Prop()
  refundPercent?: number;

  @Prop()
  cancelledAt?: Date;

  @Prop({ type: PendingFlightChangeSchema, default: null })
  pendingChange?: PendingFlightChange | null;
}

export const FlightBookingSchema = SchemaFactory.createForClass(FlightBooking);

// Look up the bookings of a flight (FLT-05, FLT-06, FLT-29).
FlightBookingSchema.index({ 'segments.flight': 1 });
