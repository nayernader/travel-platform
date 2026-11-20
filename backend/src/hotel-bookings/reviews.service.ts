import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import {
  HotelBooking,
  HotelBookingDocument,
} from './schemas/hotel-booking.schema';
import { Hotel, HotelDocument } from '../hotels/schemas/hotel.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { CreateReviewDto, ReplyReviewDto, UpdateReviewDto } from './dto/review.dto';
import { buildPage, getSkip, PAGE_SIZE } from '../common/utils/pagination';
import type { UserDocument } from '../users/schemas/user.schema';
import { NotificationType } from '../common/enums/notification-type.enum';
import { NotificationsService } from '../notifications/notifications.service';


@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviews: Model<ReviewDocument>,
    @InjectModel(HotelBooking.name)
    private bookings: Model<HotelBookingDocument>,
    @InjectModel(Hotel.name) private hotels: Model<HotelDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  /** Hotel average and count, recalculated from the visible reviews. */
  private async recalc(hotelId: any) {
    const hotelObjId =
      hotelId instanceof Types.ObjectId ? hotelId : new Types.ObjectId(hotelId);
    const [agg] = await this.reviews.aggregate([
      { $match: { hotel: hotelObjId, hidden: false } },
      { $group: { _id: '$hotel', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    await this.hotels.updateOne(
      { _id: hotelObjId },
      {
        ratingAverage: agg ? Math.round(agg.avg * 10) / 10 : 0,
        ratingCount: agg?.count ?? 0,
      },
    );
  }

  async create(user: UserDocument, bookingId: string, dto: CreateReviewDto) {
    const b = await this.bookings.findById(bookingId);
    if (!b) throw new NotFoundException('Reservation not found');
    if (b.user.toString() !== user.id) {
      throw new ForbiddenException('Not your reservation');
    }
    if (b.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(
        'You can review only after the stay is completed',
      );
    }
    try {
      const review = await this.reviews.create({
        ...dto,
        user: user._id,
        hotel: b.hotel,
        booking: b._id,
      });
      await this.recalc(b.hotel);
      return review;
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ConflictException('This reservation already has a review');
      }
      throw e;
    }
  }

  private async owned(user: UserDocument, id: string) {
    const r = await this.reviews.findById(id);
    if (!r) throw new NotFoundException('Review not found');
    if (r.user.toString() !== user.id) {
      throw new ForbiddenException('Not your review');
    }
    return r;
  }

  async update(user: UserDocument, id: string, dto: UpdateReviewDto) {
    const r = await this.owned(user, id);
    Object.assign(r, dto);
    await r.save();
    await this.recalc(r.hotel);
    return r;
  }

  async remove(user: UserDocument, id: string) {
    const r = await this.owned(user, id);
    await r.deleteOne();
    await this.recalc(r.hotel);
    return { deleted: true };
  }
    /** HTL-26: the moderator of the review's hotel replies (one reply, posting again replaces it). */
  async reply(user: UserDocument, id: string, dto: ReplyReviewDto) {
    if (!isValidObjectId(id)) throw new NotFoundException('Review not found');
    const r = await this.reviews.findById(id);
    if (!r || r.hidden) throw new NotFoundException('Review not found');
    if (!user.providerId || user.providerId.toString() !== r.hotel.toString()) {
      throw new ForbiddenException('You can only reply to reviews of your own hotel');
    }
    const first = !r.reply;
    r.reply = { text: dto.text, by: user._id, repliedAt: new Date() };
    await r.save();
    if (first) {
      await this.notifications.notify(
        r.user,
        NotificationType.REVIEW_REPLIED,
        'The hotel replied to your review',
        { reviewId: r.id, hotelId: r.hotel.toString() },
      );
    }
    return r;
  }

  /** HTL-24: newest first, paginated, hidden reviews excluded. */
  async listForHotel(hotelId: string, page = 1) {
    const hotel = await this.hotels
      .findById(hotelId)
      .select('ratingAverage ratingCount');
    if (!hotel) throw new NotFoundException('Hotel not found');
    const filter = { hotel: new Types.ObjectId(hotelId), hidden: false };
    const [items, total] = await Promise.all([
      this.reviews
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(getSkip(page))
        .limit(PAGE_SIZE)
        .populate('user', 'name'),
      this.reviews.countDocuments(filter),
    ]);
    return {
      ratingAverage: hotel.ratingAverage,
      ratingCount: hotel.ratingCount,
      ...buildPage(items, total, page),
    };
  }
}
