import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery } from 'mongoose';
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