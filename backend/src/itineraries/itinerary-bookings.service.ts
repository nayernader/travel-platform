import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import { ItinerariesService } from './itineraries.service';
import { AttachBookingDto } from './dto/attach-booking.dto';
import { AttachedBookingType } from './schemas/itinerary.schema';
import { toItineraryView } from './itinerary.view';
import { FlightBooking, FlightBookingDocument } from '../flight-bookings/schemas/flight-booking.schema';
import { HotelBooking, HotelBookingDocument } from '../hotel-bookings/schemas/hotel-booking.schema';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { UserDocument } from '../users/schemas/user.schema';
import { assertOwnership } from '../common/utils/ownership';

/** ITN-27: only confirmed bookings can be attached. To also allow finished trips, add BookingStatus.COMPLETED here. */
const ATTACHABLE_STATUSES: BookingStatus[] = [BookingStatus.CONFIRMED];

@Injectable()
export class ItineraryBookingsService {
  constructor(
    private readonly its: ItinerariesService,
    @InjectModel(FlightBooking.name) private readonly flights: Model<FlightBookingDocument>,
    @InjectModel(HotelBooking.name) private readonly hotels: Model<HotelBookingDocument>,
  ) {}

  /** ITN-27: attach one of MY confirmed bookings to one of MY itineraries. */
  async attach(user: UserDocument, itineraryId: string, dto: AttachBookingDto) {
    const it = await this.its.getOwned(user, itineraryId); // 404 if missing or not mine

    const found =
      dto.type === AttachedBookingType.FLIGHT
        ? await this.flights.findById(dto.bookingId)
        : await this.hotels.findById(dto.bookingId);
    // someone else's booking looks exactly like a missing one (404)
    const booking = assertOwnership(found, (b) => b.user, user, { notFoundMessage: 'Booking not found' });

    if (!ATTACHABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException('Only confirmed bookings can be attached to an itinerary');
    }

    // one atomic update: only pushes when this booking is not already in the list (409 otherwise)
    const entry = { type: dto.type, booking: booking._id };
    const res = await this.its.model.updateOne(
      { _id: it._id, attachedBookings: { $not: { $elemMatch: entry } } },
      { $push: { attachedBookings: entry } },
    );
    if (res.modifiedCount === 0) throw new ConflictException('This booking is already attached to this itinerary');

    return toItineraryView(await this.its.getOwned(user, itineraryId));
  }

  /** Undo an attach. 404 when that booking is not attached to this itinerary. */
  async detach(user: UserDocument, itineraryId: string, bookingId: string) {
    const it = await this.its.getOwned(user, itineraryId);
    if (!isValidObjectId(bookingId)) throw new NotFoundException('Booking is not attached to this itinerary');

    const res = await this.its.model.updateOne(
      { _id: it._id },
      { $pull: { attachedBookings: { booking: new Types.ObjectId(bookingId) } } },
    );
    if (res.modifiedCount === 0) throw new NotFoundException('Booking is not attached to this itinerary');

    return toItineraryView(await this.its.getOwned(user, itineraryId));
  }
}