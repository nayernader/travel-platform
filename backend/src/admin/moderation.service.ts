import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto, ResolveReportDto } from './dto/reports.dto';
import { Report, ReportDocument, ReportStatus, TargetType } from './schemas/report.schema';

// Team contracts: other members' models are reached by name, never by importing their files
const MODEL: Record<TargetType, string> = { post: 'Post', comment: 'Comment', review: 'Review', itinerary: 'Itinerary' };
const OWNER_FIELD: Record<TargetType, string> = { post: 'author', comment: 'author', review: 'user', itinerary: 'user' };

@Injectable()
export class ModerationService {
  constructor(
    @InjectModel(Report.name) private reports: Model<ReportDocument>,
    @InjectConnection() private connection: Connection,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private target(type: TargetType, id: string | Types.ObjectId) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Content not found');
    return this.connection.model(MODEL[type]).findById(id);
  }

  /** GEN-09: a user reports content with a reason, at most once per item (unique index). */
  async report(user: UserDocument, dto: CreateReportDto) {
    const doc: any = await this.target(dto.targetType, dto.targetId);
    if (!doc) throw new NotFoundException('Content not found');
    try {
      return await this.reports.create({ ...dto, reporter: user._id });
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('You already reported this item');
      throw e;
    }
  }

  /** GEN-10: open reports, oldest first. */
  async listOpen(page = 1) {
    const filter = { status: ReportStatus.OPEN };
    const [items, total] = await Promise.all([
      this.reports
        .find(filter)
        .sort({ createdAt: 1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .populate('reporter', 'name email'),
      this.reports.countDocuments(filter),
    ]);
    return buildPage(items, total, page);
  }

  /**
   * GEN-10: hidden content stays visible to admins. Returns any post, comment, review or itinerary,
   * hidden or not, with its open reports so the admin can decide.
   */
  async getContent(type: TargetType, id: string) {
    const doc: any = await this.target(type, id);
    if (!doc) throw new NotFoundException('Content not found');
    if (type === 'post' || type === 'comment') await doc.populate('author', 'name email');
    else await doc.populate('user', 'name email');
    const openReports = await this.reports
      .find({ targetType: type, targetId: doc._id, status: ReportStatus.OPEN })
      .sort({ createdAt: 1 })
      .populate('reporter', 'name email');
    return { type, content: doc, openReports };
  }

  /** GEN-10: hide or delete one piece of content, keep counters right, close its reports and tell its author. */
  async applyToContent(admin: UserDocument, type: TargetType, id: string, action: 'hide' | 'delete') {
    const doc: any = await this.target(type, id);
    if (!doc) throw new NotFoundException('Content not found');
    const owner = doc[OWNER_FIELD[type]];
    const wasHidden = !!doc.hidden;

    if (action === 'hide') {
      doc.hidden = true;
      await doc.save();
    } else {
      if (type === 'post') await this.connection.model('Comment').deleteMany({ post: doc._id });
      await doc.deleteOne();
    }

    // A comment that leaves the public page no longer counts on its post
    if (type === 'comment' && !wasHidden) {
      await this.connection
        .model('Post')
        .updateOne({ _id: doc.post, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
    }
    // A hotel's average rating only counts visible reviews (HTL-24)
    if (type === 'review') await this.recalcHotelRating(doc.hotel);

    // Every other open report on this item is closed with the same outcome
    await this.reports.updateMany(
      { targetType: type, targetId: doc._id, status: ReportStatus.OPEN },
      {
        status: action === 'hide' ? ReportStatus.HIDDEN : ReportStatus.DELETED,
        resolvedBy: admin._id,
        resolvedAt: new Date(),
      },
    );

    await this.audit.log({
      actorId: admin.id,
      action: action === 'hide' ? AuditAction.CONTENT_HIDDEN : AuditAction.CONTENT_DELETED,
      targetType: type,
      targetId: id,
    });
    if (owner) {
      await this.notifications.notify(
        owner,
        NotificationType.CONTENT_MODERATED,
        `Your ${type} was ${action === 'hide' ? 'hidden' : 'removed'} by a moderator`,
        { targetType: type, targetId: id },
      );
    }
    return { id, type, action };
  }

  /** GEN-10: resolve a report by dismissing it, hiding the content or deleting it. */
  async resolve(admin: UserDocument, reportId: string, dto: ResolveReportDto) {
    if (!Types.ObjectId.isValid(reportId)) throw new NotFoundException('Report not found');
    const report = await this.reports.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.OPEN) throw new BadRequestException('Report is already resolved');

    if (dto.action !== 'dismiss') {
      // The content may already be gone; the report is still closed
      await this.applyToContent(admin, report.targetType, report.targetId.toString(), dto.action).catch(
        (e) => {
          if (!(e instanceof NotFoundException)) throw e;
        },
      );
    }

    report.status =
      dto.action === 'dismiss'
        ? ReportStatus.DISMISSED
        : dto.action === 'hide'
          ? ReportStatus.HIDDEN
          : ReportStatus.DELETED;
    report.resolvedBy = admin._id;
    report.resolvedAt = new Date();
    await report.save();

    await this.audit.log({
      actorId: admin.id,
      action: dto.action === 'dismiss' ? AuditAction.REPORT_DISMISSED : AuditAction.REPORT_RESOLVED,
      targetType: 'report',
      targetId: reportId,
      details: { action: dto.action, contentType: report.targetType, contentId: report.targetId.toString() },
    });
    return report;
  }

  private async recalcHotelRating(hotelId: Types.ObjectId) {
    if (!hotelId) return;
    const [agg] = await this.connection.model('Review').aggregate([
      { $match: { hotel: new Types.ObjectId(String(hotelId)), hidden: false } },
      { $group: { _id: '$hotel', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await this.connection.model('Hotel').updateOne(
      { _id: hotelId },
      { ratingAverage: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.count ?? 0 },
    );
  }
}
