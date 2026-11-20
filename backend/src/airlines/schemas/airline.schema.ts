import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

// FLT-09: cancel at least N days before departure -> X% refund
@Schema({ _id: false })
export class CancellationTier {
  @Prop({ type: Number, required: true, min: 0 })
  daysBefore: number;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  refundPercent: number;
}
export const CancellationTierSchema = SchemaFactory.createForClass(CancellationTier);

// FLT-08: price per extra bag (> 0) and max extra bags per passenger
@Schema({ _id: false })
export class BaggagePolicy {
  @Prop({ type: Number, required: true, min: 0.01 })
  pricePerExtraBag: number;

  @Prop({ type: Number, required: true, min: 0 })
  maxExtraBags: number;
}
export const BaggagePolicySchema = SchemaFactory.createForClass(BaggagePolicy);

@Schema({ timestamps: true })
export class Airline {
  @Prop({ required: true, unique: true, trim: true, maxlength: 100 })
  name: string;

  // IATA airline code, e.g. "MS"
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  description?: string;

  @Prop({ type: String })
  logoUrl?: string;

  // ACC-15: a deactivated airline is hidden from search and cannot be booked.
  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  @Prop({ type: [CancellationTierSchema], default: [] })
  cancellationPolicy: CancellationTier[];

  @Prop({ type: BaggagePolicySchema, required: false })
  baggagePolicy?: BaggagePolicy;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);