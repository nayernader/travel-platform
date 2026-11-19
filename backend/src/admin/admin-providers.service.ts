import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Connection, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { NotificationType } from '../common/enums/notification-type.enum';
import { Role } from '../common/enums/role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { CreateModeratorDto } from './dto/moderators.dto';

export type ProviderType = 'airline' | 'hotel';

@Injectable()
export class AdminProvidersService {
  constructor(
    @InjectConnection() private connection: Connection,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // Team contracts: 'Airline' and 'Hotel' are read by model name
  private providerModel(type: ProviderType) {
    return this.connection.model(type === 'airline' ? 'Airline' : 'Hotel');
  }

  /** ACC-13: a moderator is linked to exactly ONE provider and must change the temporary password at first login. */
  async createModerator(admin: UserDocument, dto: CreateModeratorDto) {
    const type: ProviderType = dto.role === Role.AIRLINE_MODERATOR ? 'airline' : 'hotel';
    const provider: any = await this.providerModel(type).findById(dto.providerId);
    if (!provider) throw new BadRequestException(`No ${type} found with this providerId`);

    // A duplicate email hits the unique index -> 409 from the global exception filter
    const user: any = await this.connection.model('User').create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      role: dto.role,
      providerId: provider._id,
      status: UserStatus.ACTIVE,
      passwordHash: await bcrypt.hash(dto.temporaryPassword, 10), // GEN-13: salted hash only
      mustChangePassword: true, // the guard blocks everything except change-password until done
    });

    await this.audit.log({
      actorId: admin.id,
      action: AuditAction.MODERATOR_CREATED,
      targetType: 'user',
      targetId: user.id,
      details: { email: user.email, role: user.role, providerType: type, providerId: provider.id },
    });
    // Never return the password or its hash
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      providerId: user.providerId,
      providerName: provider.name,
      mustChangePassword: true,
    };
  }

  /**
   * ACC-15: a deactivated provider vanishes from search and cannot be booked; Confirmed bookings stay valid.
   * This is separate from suspending the moderator's account.
   */
  async setProviderActive(admin: UserDocument, type: ProviderType, id: string, active: boolean) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Provider not found');
    const model = this.providerModel(type);
    const provider: any = await model.findById(id).select('name isActive');
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.isActive === active) {
      throw new BadRequestException(`This ${type} is already ${active ? 'active' : 'deactivated'}`);
    }
    await model.updateOne({ _id: provider._id }, { isActive: active });

    await this.audit.log({
      actorId: admin.id,
      action: active ? AuditAction.PROVIDER_REACTIVATED : AuditAction.PROVIDER_DEACTIVATED,
      targetType: type,
      targetId: id,
      details: { name: provider.name },
    });

    // Tell the provider's moderators
    const role = type === 'airline' ? Role.AIRLINE_MODERATOR : Role.HOTEL_MODERATOR;
    const mods = await this.connection.model('User').find({ providerId: provider._id, role }).select('_id');
    await Promise.all(
      mods.map((m) =>
        this.notifications.notify(
          m._id as Types.ObjectId,
          NotificationType.PROVIDER_STATUS_CHANGED,
          `Your ${type} ${provider.name} was ${active ? 'reactivated' : 'deactivated'} by an administrator`,
          { providerType: type, providerId: id, isActive: active },
        ),
      ),
    );
    return { id, type, name: provider.name, isActive: active };
  }
}
