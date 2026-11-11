import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

@Schema({ _id: false })
export class DateRange {
  @Prop({ type: Date, required: true }) start: Date;
  @Prop({ type: Date, required: true }) end: Date; // exclusive: the check-out day
}

@Schema({ timestamps: true })
export class Room {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Hotel', required: true, index: true })
  hotel: MongooseSchema.Types.ObjectId;
  @Prop({ required: true, trim: true }) roomNumber: string;
  @Prop({ required: true, trim: true }) type: string; // e.g. Double, Suite
  @Prop({ required: true, min: 1 }) beds: number;
  @Prop({ required: true, min: 1 }) maxOccupancy: number;
  @Prop({ required: true, min: 0.01 }) pricePerNight: number;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: [DateRange], default: [] }) availableRanges: DateRange[]; // HTL-04
  @Prop({ type: [DateRange], default: [] }) blockedRanges: DateRange[]; // HTL-06
}
export const RoomSchema = SchemaFactory.createForClass(Room);
RoomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });
