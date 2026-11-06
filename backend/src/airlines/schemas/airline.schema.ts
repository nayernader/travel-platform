import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirlineDocument = HydratedDocument<Airline>;

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
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);