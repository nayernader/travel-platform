import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

export const TARGET_TYPES = ['post', 'comment', 'review', 'itinerary'] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export enum ReportStatus {
  OPEN = 'OPEN',
  DISMISSED = 'DISMISSED',
  HIDDEN = 'HIDDEN',
  DELETED = 'DELETED',
}

@Schema({ timestamps: true })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ type: String, required: true, enum: TARGET_TYPES })
  targetType: TargetType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 500 })
  reason: string;

  @Prop({ type: String, enum: Object.values(ReportStatus), default: ReportStatus.OPEN, index: true })
  status: ReportStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  resolvedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);
// GEN-09: a user can report the same item at most once
ReportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true });
