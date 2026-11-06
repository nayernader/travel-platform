import {
  BadRequestException,
  ConflictException, // NEW
  ForbiddenException, // NEW
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter'; // NEW
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt'; // NEW
import { Model, UpdateQuery } from 'mongoose';
import { Role } from '../common/enums/role.enum'; // NEW
import { UserStatus } from '../common/enums/user-status.enum'; // NEW
import { USER_DEACTIVATION_CHECK } from '../common/events/user-deactivation.event'; // NEW
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly events: EventEmitter2, // NEW
  ) {}

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

  // ACC-09. Only name, phone and preferredCurrency can be changed here.
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

  // NEW: ACC-12. A user deactivates their own account. The data is kept; login is no longer possible.
  async deactivateSelf(userId: string, password: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // An admin deactivating themselves could leave the platform without an admin
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be deactivated this way');
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Password is incorrect');
    }

    // Ask the booking modules how many future Confirmed bookings this user has (see user-deactivation.event.ts)
    const answers = await this.events.emitAsync(USER_DEACTIVATION_CHECK, { userId: user.id });
    const blocking = answers.reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
    if (blocking > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'HAS_FUTURE_BOOKINGS',
        message: `You have ${blocking} upcoming confirmed booking(s). Cancel them before deactivating your account.`,
      });
    }

    await this.updateById(user.id, {
      $set: { status: UserStatus.DEACTIVATED },
      $unset: { refreshTokenHash: 1 }, // logged out everywhere
    });
    return { deactivated: true };
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