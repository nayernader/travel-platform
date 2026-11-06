import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { NotificationsService } from '../notifications/notifications.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

// No look-alike characters (0/O, 1/l/I), so the admin can read it out to the user without mistakes
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 12;

@Injectable()
export class AdminService {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ACC-07a: an admin resets a user's password to a temporary one.
  // The user must change it on the next login (ACC-13 guard).
  async resetPassword(admin: UserDocument, userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new BadRequestException('Invalid id format');

    const target = await this.users.findById(userId);
    if (!target) throw new NotFoundException('User not found');

    // One admin account must not be able to take over another one
    if (target.role === Role.ADMIN) {
      throw new ForbiddenException('Admin passwords cannot be reset with this endpoint');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10); // GEN-13: salted hash

    await this.users.updateById(target.id, {
      $set: { passwordHash, mustChangePassword: true, failedLoginAttempts: 0 },
      // Revokes every refresh token (logged out everywhere) and removes any lockout
      $unset: { refreshTokenHash: 1, lockUntil: 1 },
    });

    // The temporary password is never written to the audit log or the notification
    await this.audit.log({
      actorId: admin.id,
      action: AuditAction.PASSWORD_RESET_BY_ADMIN,
      targetType: 'user',
      targetId: target.id,
      details: { email: target.email },
    });

    await this.notifications.notify(
      target.id,
      NotificationType.PASSWORD_RESET,
      'An administrator reset your password. Log in with the temporary password you were given, then choose a new one.',
    );

    // Returned once, so the admin can pass it to the user. It cannot be retrieved again.
    return {
      userId: target.id,
      email: target.email,
      temporaryPassword,
      mustChangePassword: true,
      message: 'Give this temporary password to the user. They must change it after logging in.',
    };
  }

  // Random 12-character password with at least one letter and one digit (same rule as ChangePasswordDto)
  private generateTemporaryPassword(): string {
    let password = '';
    do {
      password = Array.from(
        { length: TEMP_PASSWORD_LENGTH },
        () => TEMP_PASSWORD_CHARS[randomInt(TEMP_PASSWORD_CHARS.length)],
      ).join('');
    } while (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(password));
    return password;
  }
}