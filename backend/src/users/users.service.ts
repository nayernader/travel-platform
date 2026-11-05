import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'; // NEW: two exceptions
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
import { UpdateProfileDto } from './dto/update-profile.dto'; // NEW
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }

  findById(id: string) {
    return this.userModel.findById(id);
  }

  updateById(id: string, update: UpdateQuery<UserDocument>) {
    return this.userModel.findByIdAndUpdate(id, update, { new: true });
  }

  // NEW: ACC-09. Only name, phone and preferredCurrency can be changed here.
  // Email, role and status are never read from the request body.
  async updateProfile(id: string, dto: UpdateProfileDto) {
    const changes: Record<string, string> = {};
    if (dto.name !== undefined) changes.name = dto.name.trim();
    if (dto.phone !== undefined) changes.phone = dto.phone;
    if (dto.preferredCurrency !== undefined) changes.preferredCurrency = dto.preferredCurrency;

    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Send at least one of: name, phone, preferredCurrency');
    }

    const updated = await this.updateById(id, { $set: changes });
    if (!updated) throw new NotFoundException('User not found');
    return this.toResponse(updated);
  }

  // The only shape of a user that may leave the backend (never the hash or tokens)
  toResponse(user: UserDocument) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      preferredCurrency: user.preferredCurrency,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      createdAt: (user as UserDocument & { createdAt?: Date }).createdAt,
    };
  }
}