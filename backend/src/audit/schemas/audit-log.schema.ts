import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { AuditAction } from '../../common/enums/audit-action.enum';

export type AuditLogDocument = HydratedDocument<AuditLog>;

// Audit records are append-only: no updatedAt, and the service has no update or delete
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
    @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AuditAction), required: true })
  action: AuditAction;

  @Prop({ type: String, required: true }) // e.g. 'user', 'post', 'comment'
  targetType: string;

  @Prop({ type: String })
  targetId?: string;

  @Prop({ type: Object })
  details?: Record<string, unknown>;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });