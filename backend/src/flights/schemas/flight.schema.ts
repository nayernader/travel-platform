import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;

export enum FlightStatus { SCHEDULED = 'SCHEDULED', CANCELLED = 'CANCELLED', DEPARTED = 'DEPARTED' }

export enum CabinClass {
  ECONOMY = 'Economy', PREMIUM_ECONOMY = 'Premium Economy', BUSINESS = 'Business', FIRST = 'First',
}

@Schema()
export class Cabin {
  @Prop({ required: true, enum: Object.values(CabinClass) }) cabinClass: CabinClass;
  @Prop({ required: true, min: 1 }) totalSeats: number;
  @Prop({ required: true, min: 0 }) availableSeats: number;
  @Prop({ required: true, min: 0.01 }) price: number;
  @Prop({ required: true, min: 0 }) freeBags: number;
  @Prop({ required: true, min: 0.1 }) maxBagWeightKg: number;
}
export const CabinSchema = SchemaFactory.createForClass(Cabin);

@Schema({ timestamps: true })
export class Flight {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Airline', required: true, index: true })
  airline: MongooseSchema.Types.ObjectId;
  @Prop({ required: true, uppercase: true, trim: true }) flightNumber: string;
  @Prop({ required: true }) departureAirport: string;
  @Prop({ required: true }) arrivalAirport: string;
  @Prop({ required: true, index: true }) departureTimeUtc: Date;
  @Prop({ required: true }) arrivalTimeUtc: Date;
  @Prop({ required: true }) departureDate: string;
  @Prop({ enum: Object.values(FlightStatus), default: FlightStatus.SCHEDULED, index: true })
  status: FlightStatus;
  @Prop({ type: [CabinSchema], default: [] }) cabins: Cabin[];
}
export const FlightSchema = SchemaFactory.createForClass(Flight);
FlightSchema.index({ airline: 1, flightNumber: 1, departureDate: 1 }, { unique: true });