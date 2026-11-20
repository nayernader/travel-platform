import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { CabinClass } from '../../flights/schemas/flight.schema';

export type SeatClaimDocument = HydratedDocument<SeatClaim>;

/** FLT-28: one document = one seat taken by one passenger on one flight. */
@Schema({ timestamps: true })
export class SeatClaim {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Flight', required: true })
  flight: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(CabinClass) })
  cabinClass: CabinClass;

  @Prop({ required: true, uppercase: true, trim: true })
  seatNumber: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'FlightBooking', required: true, index: true })
  booking: Types.ObjectId;

  /** Position of the passenger in booking.passengers (0-based). */
  @Prop({ required: true, min: 0 })
  passengerIndex: number;
}
export const SeatClaimSchema = SchemaFactory.createForClass(SeatClaim);

// Two people can never hold the same seat: the database rejects the second insert (code 11000).
SeatClaimSchema.index({ flight: 1, cabinClass: 1, seatNumber: 1 }, { unique: true });
// One seat per passenger per flight, which makes "change my seat" a single atomic update.
SeatClaimSchema.index({ booking: 1, flight: 1, passengerIndex: 1 }, { unique: true });