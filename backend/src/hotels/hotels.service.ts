import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { unlinkSync } from 'fs';
import { Hotel, HotelDocument } from './schemas/hotel.schema';
import { CreateHotelDto, UpdateHotelDto } from './dto/hotel.dto';
import { PoliciesDto } from './dto/policies.dto';
import { Role } from '../common/enums/role.enum';
import { UploadsService } from '../uploads/uploads.service';
import { MAX_IMAGES_PER_ITEM } from '../uploads/uploads.constants';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class HotelsService {
  constructor(
    @InjectModel(Hotel.name) private model: Model<HotelDocument>,
    private readonly uploads: UploadsService,
  ) {}

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

  /** HTL-09, HTL-10: check-in/out times and cancellation tiers. */
  async setPolicies(user: UserDocument, id: string, dto: PoliciesDto) {
    this.assertManages(user, id);
    const patch: Record<string, unknown> = {};
    if (dto.checkInTime) patch.checkInTime = dto.checkInTime;
    if (dto.checkOutTime) patch.checkOutTime = dto.checkOutTime;
    if (dto.cancellationTiers) {
      const days = dto.cancellationTiers.map((t) => t.daysBefore);
      if (new Set(days).size !== days.length) throw new BadRequestException('Each days-before value must be unique');
      patch.cancellationPolicy = dto.cancellationTiers;
    }
    const hotel = await this.model.findByIdAndUpdate(id, patch, { returnDocument: 'after' });
    if (!hotel) throw new NotFoundException('Hotel not found');
    return hotel;
  }

  /** HTL-01 photos (GEN-08): up to 5 JPG/PNG photos per hotel, stored as URLs. */
  async addPhotos(user: UserDocument, id: string, files: Express.Multer.File[]) {
    this.assertManages(user, id);
    const hotel = await this.findOne(id);
    if (hotel.photos.length + (files?.length ?? 0) > MAX_IMAGES_PER_ITEM) {
      (files ?? []).forEach((f) => { try { unlinkSync(f.path); } catch { /* ignore */ } }); // remove what multer already saved
      throw new BadRequestException(`A hotel can have at most ${MAX_IMAGES_PER_ITEM} photos`);
    }
    const urls = this.uploads.processImages(files);
    hotel.photos.push(...urls);
    return hotel.save();
  }
}
