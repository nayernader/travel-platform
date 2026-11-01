import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AirportDocument = HydratedDocument<Airport>;

@Schema({ versionKey: false })
export class Airport {
  @Prop({ type: String }) // IATA code, e.g. "CAI"
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, ref: 'City', required: true, index: true })
  cityId: string;

  @Prop({ type: String, ref: 'Country', required: true })
  countryCode: string;

  // FLT-02, GEN-06: flight times are entered and shown in the airport's local time
  @Prop({ required: true }) // IANA time zone, e.g. "Africa/Cairo"
  timezone: string;
}

export const AirportSchema = SchemaFactory.createForClass(Airport);