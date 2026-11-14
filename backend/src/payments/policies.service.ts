import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, isValidObjectId } from 'mongoose';
import { PolicyAcceptance, PolicyAcceptanceDocument } from './schemas/policy-acceptance.schema';
import { UserDocument } from '../users/schemas/user.schema';

export type BookingType = 'flight' | 'hotel';

@Injectable()
export class PoliciesService {
  constructor(
    @InjectModel(PolicyAcceptance.name) private acceptances: Model<PolicyAcceptanceDocument>,
    @InjectConnection() private connection: Connection,
  ) {}

  private async ownBooking(user: UserDocument, type: BookingType, id: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid booking id');
    const b: any = await this.connection
      .model(type === 'flight' ? 'FlightBooking' : 'HotelBooking')
      .findById(id);
    if (!b) throw new NotFoundException('Booking not found');
    if (b.user.toString() !== user.id) throw new ForbiddenException('Not your booking');
    return b;
  }

  private isAccepted(type: BookingType, id: string) {
    return this.acceptances.exists({ bookingType: type, bookingId: new Types.ObjectId(id) });
  }

  async getPolicies(user: UserDocument, type: BookingType, id: string) {
    const b = await this.ownBooking(user, type, id);
    const accepted = !!(await this.isAccepted(type, id));

    if (type === 'flight') {
      const flight: any = await this.connection
        .model('Flight')
        .findById(b.segments[0].flight)
        .populate('airline', 'name cancellationPolicy baggagePolicy');
      if (!flight?.airline) throw new NotFoundException('Airline not found');
      return {
        type,
        provider: flight.airline.name,
        cancellationPolicy: flight.airline.cancellationPolicy,
        baggagePolicy: flight.airline.baggagePolicy,
        accepted,
      };
    }

    const hotel: any = await this.connection.model('Hotel').findById(b.hotel);
    if (!hotel) throw new NotFoundException('Hotel not found');
    return {
      type,
      provider: hotel.name,
      cancellationPolicy: hotel.cancellationPolicy,
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      accepted,
    };
  }

  async accept(user: UserDocument, type: BookingType, id: string) {
    const b = await this.ownBooking(user, type, id);
    if (b.status !== 'PENDING_PAYMENT') {
      throw new ConflictException('This booking is no longer waiting for payment');
    }
    const bookingId = new Types.ObjectId(id);
    const existing = await this.acceptances.findOne({ bookingType: type, bookingId });
    return existing ?? this.acceptances.create({ user: user._id, bookingType: type, bookingId });
  }

  async hasAccepted(type: BookingType, id: string) {
    return !!(await this.isAccepted(type, id));
  }
}