import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditAction } from '../common/enums/audit-action.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditEntry {
  actorId: string | Types.ObjectId;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly model: Model<AuditLogDocument>) {}

  // Other modules call this after an admin action:
  // await this.audit.log({ actorId: admin.id, action: AuditAction.USER_SUSPENDED, targetType: 'user', targetId: id })
  log(entry: AuditEntry) {
    return this.model.create(entry);
  }

  // The admin owner uses this for GET /api/admin/audit-logs
  async list(page: number, filter: { action?: AuditAction; actorId?: string } = {}) {
    const query: Record<string, unknown> = {};
    if (filter.action) query.action = filter.action;
    if (filter.actorId) query.actorId = filter.actorId;

    const [items, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(getSkip(page)).limit(PAGE_SIZE),
      this.model.countDocuments(query),
    ]);
    return buildPage(items, total, page);
  }
}