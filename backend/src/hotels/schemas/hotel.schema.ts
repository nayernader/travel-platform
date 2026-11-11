import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type HotelDocument = HydratedDocument<Hotel>;

@Schema({ _id: false })
export class HotelCancellationTier {
  @Prop({ required: true, min: 0 }) daysBefore: number;
  @Prop({ required: true, min: 0, max: 100 }) refundPercent: number;
}

@Schema({ timestamps: true })
export class Hotel {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, trim: true }) address: string;
  @Prop({ required: true, index: true }) city: string; // reference-data id, e.g. 'cairo'
  @Prop({ required: true, index: true }) country: string; // reference-data id, e.g. 'EG'
  @Prop({ trim: true }) description?: string;
  @Prop({ type: [String], default: [] }) photos: string[];
  @Prop({ min: 1, max: 5 }) starClass?: number;
  @Prop({ type: [String], default: [] }) amenities: string[];
  @Prop({ default: '14:00' }) checkInTime: string;
  @Prop({ default: '12:00' }) checkOutTime: string;
  @Prop({ type: [HotelCancellationTier], default: [] }) cancellationPolicy: HotelCancellationTier[];
  /** Maintained by Member 5 when reviews are created, edited or deleted. */
  @Prop({ default: 0 }) ratingAverage: number;
  @Prop({ default: 0 }) ratingCount: number;
  /** ACC-15: a deactivated hotel is hidden from search and cannot be booked (Member 8 toggles this). */
  @Prop({ default: true }) isActive: boolean;
}
export const HotelSchema = SchemaFactory.createForClass(Hotel);
