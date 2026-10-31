import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationType } from '../common/enums/notification-type.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
  ) {}

  // Other modules call this: await this.notifications.notify(userId, type, message)
  notify(
    userId: string | Types.ObjectId,
    type: NotificationType,
    message: string,
    data?: Record<string, unknown>,
  ) {
    return this.model.create({ userId, type, message, data });
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