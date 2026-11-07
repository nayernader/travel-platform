import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Airline, AirlineDocument } from './schemas/airline.schema';
import { CreateAirlineDto, UpdateAirlineDto } from './dto/create-airline.dto';
import { BaggagePolicyDto } from './dto/baggage-policy.dto';
import { CancellationPolicyDto } from './dto/cancellation-policy.dto';

import { Role } from '../common/enums/role.enum';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AirlinesService {
  constructor(@InjectModel(Airline.name) private model: Model<AirlineDocument>) {}

  create(dto: CreateAirlineDto) {
    return this.model.create(dto); // duplicate code -> 409 from the global filter
  }

  async findOne(id: string) {
    const airline = await this.model.findById(id);
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }

  /** Admin can edit any airline. A moderator only the airline assigned to them. */
  assertCanManage(user: UserDocument, airlineId: string) {
    if (user.role === Role.ADMIN) return;
    if (!user.providerId || user.providerId.toString() !== airlineId.toString()) {
      throw new ForbiddenException('You can only manage your own airline');
    }
  }

  async update(user: UserDocument, id: string, dto: UpdateAirlineDto) {
    this.assertCanManage(user, id);
    const airline = await this.model.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }

  // ---------------- FLT-08: baggage policy ----------------
  async setBaggagePolicy(user: UserDocument, id: string, dto: BaggagePolicyDto) {
    this.assertCanManage(user, id);
    const airline = await this.model.findByIdAndUpdate(
      id,
      { baggagePolicy: dto },
      { returnDocument: 'after', runValidators: true },
    );
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }

  // ---------------- FLT-09: cancellation tiers ----------------
  async setCancellationPolicy(user: UserDocument, id: string, dto: CancellationPolicyDto) {
    this.assertCanManage(user, id);
    const days = dto.tiers.map((t) => t.daysBefore);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException('Each days-before value must be unique');
    }
    const airline = await this.model.findByIdAndUpdate(
      id,
      { cancellationPolicy: dto.tiers },
      { returnDocument: 'after', runValidators: true },
    );
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }
}