import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { ListAccountsDto } from './dto/accounts.dto';

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class AdminAccountsService {
  constructor(
    @InjectConnection() private connection: Connection,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // Team contract: the User model is read by name, so no other member's file is imported
  private get users() {
    return this.connection.model('User');
  }

  /** ACC-14: paginated list with search by name or email, filter by role and status. Never returns password data. */
  async list(dto: ListAccountsDto) {
    const filter: Record<string, unknown> = {};
    if (dto.role) filter.role = dto.role;
    if (dto.status) filter.status = dto.status;
    if (dto.search) {
      const rx = new RegExp(escapeRegex(dto.search.trim()), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const page = dto.page ?? 1;
    const [items, total] = await Promise.all([
      this.users
        .find(filter)
        .select('name email role status providerId createdAt')
        .sort({ createdAt: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE),
      this.users.countDocuments(filter),
    ]);
    return buildPage(items, total, page);
  }

  /** ACC-15 (moderators) and ACC-16 (users): the same rules. Admins cannot be suspended. */
  async setSuspended(admin: UserDocument, id: string, suspend: boolean) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Invalid id format');
    const target: any = await this.users.findById(id);
    if (!target) throw new NotFoundException('Account not found');
    if (target.role === Role.ADMIN) throw new BadRequestException('Admin accounts cannot be suspended');
    if (target.status === UserStatus.DEACTIVATED) {
      throw new BadRequestException('Account is deactivated');
    }
    if (suspend && target.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('Account is already suspended');
    }
    if (!suspend && target.status !== UserStatus.SUSPENDED) {
      throw new BadRequestException('Account is not suspended');
    }

    target.status = suspend ? UserStatus.SUSPENDED : UserStatus.ACTIVE;
    // A suspension also revokes the refresh token, so no session can be renewed (the guard blocks the rest)
    if (suspend) target.refreshTokenHash = undefined;
    await target.save();

    await this.audit.log({
      actorId: admin.id,
      action: suspend ? AuditAction.USER_SUSPENDED : AuditAction.USER_REACTIVATED,
      targetType: 'user',
      targetId: id,
      details: { email: target.email, role: target.role },
    });
    await this.notifications.notify(
      target._id,
      suspend ? NotificationType.ACCOUNT_SUSPENDED : NotificationType.ACCOUNT_REACTIVATED,
      suspend ? 'Your account was suspended by an administrator' : 'Your account was reactivated',
    );
    return { id, status: target.status };
  }

  /** GEN-07 viewer: audit log of admin actions, newest first. */
  auditLogs(page = 1) {
    return this.audit.list(page);
  }
}
