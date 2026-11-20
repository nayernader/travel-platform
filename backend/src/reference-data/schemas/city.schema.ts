import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CityDocument = HydratedDocument<City>;

@Schema({ versionKey: false })
export class City {
  @Prop({ type: String }) // e.g. "cairo"
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, ref: 'Country', required: true, index: true })
  countryCode: string;
}

export const CitySchema = SchemaFactory.createForClass(City);