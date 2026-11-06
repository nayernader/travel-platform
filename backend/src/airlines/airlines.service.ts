import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { Airline, AirlineDocument } from './schemas/airline.schema';
import { CreateAirlineDto, UpdateAirlineDto } from './dto/create-airline.dto';
import { ListAirlinesQueryDto } from './dto/list-airlines-query.dto';
import type { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AirlinesService {
  constructor(@InjectModel(Airline.name) private airlineModel: Model<AirlineDocument>) {}

  async create(dto: CreateAirlineDto) {
    try {
      return await this.airlineModel.create(dto);
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Airline name or code already exists');
      throw e;
    }
  }

  async findAll(query: ListAirlinesQueryDto) {
    const { page, limit, search } = query;
    const filter: Record<string, unknown> = { isActive: true }; // ACC-15: deactivated airlines are hidden

    if (search) {
      // escape regex characters so user input can't break or abuse the query
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ name: new RegExp(safe, 'i') }, { code: new RegExp(safe, 'i') }];
    }

    const [items, total] = await Promise.all([
      this.airlineModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
      this.airlineModel.countDocuments(filter),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const airline = await this.airlineModel.findById(id);
    if (!airline) throw new NotFoundException('Airline not found');
    return airline;
  }

  // Reused by flights: admin passes, a moderator only for their own airline (GEN-13)
  assertCanManage(user: Pick<UserDocument, 'role' | 'providerId'>, airlineId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.AIRLINE_MODERATOR && user.providerId?.toString() === airlineId) return;
    throw new ForbiddenException('You can only manage your own airline');
}

  async update(id: string, dto: UpdateAirlineDto, user: Pick<UserDocument, 'role' | 'providerId'>) {
    this.assertCanManage(user, id);
    try {
      const airline = await this.airlineModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true });
      if (!airline) throw new NotFoundException('Airline not found');
      return airline;
    } catch (e: any) {
      if (e?.code === 11000) throw new ConflictException('Airline name or code already exists');
      throw e;
    }
  }
}