import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AttractionDocument = HydratedDocument<Attraction>;

@Schema({ versionKey: false })
export class Attraction {
  @Prop({ type: String }) // e.g. "att-1"
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, ref: 'City', required: true, index: true })
  cityId: string;
}

export const AttractionSchema = SchemaFactory.createForClass(Attraction);