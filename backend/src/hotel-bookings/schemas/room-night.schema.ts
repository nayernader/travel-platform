import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
export type RoomNightDocument = HydratedDocument<RoomNight>;
/** One reserved night of one room. The unique index makes double booking impossible. */
@Schema()
export class RoomNight {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true }) room:
      MongooseSchema.Types.ObjectId;
  @Prop({ type: Date, required: true }) date: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'HotelBooking', required: true, index: true })
      booking: MongooseSchema.Types.ObjectId;
}
export const RoomNightSchema = SchemaFactory.createForClass(RoomNight);
RoomNightSchema.index({ room: 1, date: 1 }, { unique: true });