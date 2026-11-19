import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, UpdateQuery } from 'mongoose';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { USER_DEACTIVATION_CHECK } from '../common/events/user-deactivation.event';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly events: EventEmitter2,
  ) {}

  create(data: Partial<User>) {
    return this.userModel.create(data);
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }
  
  /** ACC-02: loads the hidden verification fields too. */
  findByEmailWithVerification(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+emailVerificationCodeHash +emailVerificationExpiresAt +emailVerificationAttempts +emailVerificationSentAt');
  }

    /** ACC-07: loads the hidden reset fields too. */
  findByEmailWithReset(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordResetCodeHash +passwordResetExpiresAt +passwordResetAttempts +passwordResetSentAt');
  }

  /**
   * ACC-07: sets the new password in ONE atomic update, only if the code is still valid and the
   * account is ACTIVE. Also revokes every refresh token, removes any lockout and wipes the code,
   * so the same code can never be used twice.
   */
  completePasswordReset(id: string, codeHash: string, passwordHash: string) {
    return this.userModel.findOneAndUpdate(
      {
        _id: id,
        status: UserStatus.ACTIVE,
        passwordResetCodeHash: codeHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          passwordHash,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          passwordResetAttempts: 0,
          emailVerified: true, // they received the code at this address
        },
        $unset: {
          refreshTokenHash: 1,
          lockUntil: 1,
          passwordResetCodeHash: 1,
          passwordResetExpiresAt: 1,
          passwordResetSentAt: 1,
        },
      },
      { returnDocument: 'after' },
    );
  }
  
  /** ACC-02: marks the account verified and wipes the code. */
  markEmailVerified(id: string) {
    return this.userModel.findOneAndUpdate(
      { _id: id, emailVerified: false },
      {
        $set: { emailVerified: true, emailVerificationAttempts: 0 },
        $unset: { emailVerificationCodeHash: 1, emailVerificationExpiresAt: 1, emailVerificationSentAt: 1 },
      },
      { returnDocument: 'after' },
    );
  }

  findById(id: string) {
    return this.userModel.findById(id);
  }

  updateById(id: string, update: UpdateQuery<UserDocument>) {
    // returnDocument: 'after' returns the updated document ('new: true' is deprecated in Mongoose)
    return this.userModel.findByIdAndUpdate(id, update, { returnDocument: 'after' });
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

  // ACC-12. A user deactivates their own account. The data is kept; login is no longer possible.
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
      emailVerified: user.emailVerified,
    };
  }
}
