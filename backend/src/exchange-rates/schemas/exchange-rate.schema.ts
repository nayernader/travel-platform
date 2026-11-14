import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExchangeRateDocument = HydratedDocument<ExchangeRate>;

@Schema({ timestamps: true })
export class ExchangeRate {
  @Prop({ required: true }) base: string;
  @Prop({ type: Object, required: true }) rates: Record<string, number>;
  @Prop({ required: true }) rateDate: string; // YYYY-MM-DD, shown to the user (ITN-18)
  @Prop({ type: Date, required: true }) fetchedAt: Date;
}

export const ExchangeRateSchema = SchemaFactory.createForClass(ExchangeRate);