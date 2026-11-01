import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CountryDocument = HydratedDocument<Country>;

@Schema({ versionKey: false })
export class Country {
  @Prop({ type: String }) // ISO code, e.g. "EG"
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true }) // e.g. "EGP"
  currency: string;
}

export const CountrySchema = SchemaFactory.createForClass(Country);