import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType } from '../common/enums/notification-type.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { Notification, NotificationDocument } from './schemas/notification.schema';

// GEN-01 bonus: only these in-app notifications also get an email, with this subject
const EMAIL_SUBJECTS: Partial<Record<NotificationType, string>> = {
  [NotificationType.BOOKING_CONFIRMED]: 'Your booking is confirmed',
  [NotificationType.BOOKING_CANCELLED]: 'Your booking was cancelled',
  [NotificationType.REFUND_PROCESSED]: 'Your refund was processed',
  [NotificationType.REFUND_UPDATED]: 'Your refund status changed',
  [NotificationType.FLIGHT_SCHEDULE_CHANGED]: 'Your flight schedule changed',
  [NotificationType.FLIGHT_CANCELLED]: 'Your flight was cancelled',
  [NotificationType.ACCOUNT_SUSPENDED]: 'Your account was suspended',
  [NotificationType.ACCOUNT_REACTIVATED]: 'Your account was reactivated',
  [NotificationType.PROVIDER_SUSPENDED]: 'Your provider was suspended',
  [NotificationType.PROVIDER_STATUS_CHANGED]: 'Your provider status changed',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  // Other modules call this: await this.notifications.notify(userId, type, message)
  async notify(
    userId: string | Types.ObjectId,
    type: NotificationType,
    message: string,
    data?: Record<string, unknown>,
  ) {
    const created = await this.model.create({ userId, type, message, data });
    void this.emailCopy(userId.toString(), type, message); // not awaited: it can never delay or break the caller
    return created;
  }

  /** GEN-01 bonus: failures are logged and ignored. */
  private async emailCopy(userId: string, type: NotificationType, message: string) {
    const subject = EMAIL_SUBJECTS[type];
    if (!subject) return;
    try {
      const user = await this.users.findById(userId);
      if (!user || user.emailVerified === false || user.status === UserStatus.DEACTIVATED) return;
      await this.mail.sendNotificationEmail(user.email, user.name, subject, message);
    } catch (err) {
      this.logger.error('Could not send the notification email', err as Error);
    }
  }

  async list(userId: string, page: number) {
    const [items, total] = await Promise.all([
      this.model
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE),
      this.model.countDocuments({ userId }),
    ]);
    return buildPage(items, total, page);
  }

  async unreadCount(userId: string) {
    const count = await this.model.countDocuments({ userId, read: false });
    return { count };
  }

  // Ownership check: you can only mark your own notifications
  async markRead(userId: string, id: string) {
    const result = await this.model.updateOne({ _id: id, userId }, { read: true });
    if (result.matchedCount === 0) throw new NotFoundException('Notification not found');
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    const result = await this.model.updateMany({ userId, read: false }, { read: true });
    return { updated: result.modifiedCount };
  }
}