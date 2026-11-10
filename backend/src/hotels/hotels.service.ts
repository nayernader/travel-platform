import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { CreateHotelDto, UpdateHotelDto } from './dto/hotel.dto';
import { Role } from '../common/enums/role.enum';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class HotelsService {
  constructor(@InjectModel(Hotel.name) private model: Model<HotelDocument>) {}

  create(dto: CreateHotelDto) {
    return this.model.create(dto);
  }

  async findOne(id: string) {
    const hotel = await this.model.findById(id);
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  /** Admin manages any hotel; a hotel moderator only the one assigned to them. */
  assertManages(user: UserDocument, hotelId: string) {
    if (user.role === Role.ADMIN) return;
    if (!user.providerId || user.providerId.toString() !== hotelId.toString()) {
      throw new ForbiddenException('You can only manage your own hotel');
    }
  }

  async update(user: UserDocument, id: string, dto: UpdateHotelDto) {
    this.assertManages(user, id);
    const hotel = await this.model.findByIdAndUpdate(id, dto, { returnDocument: 'after', runValidators: true });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }
}
