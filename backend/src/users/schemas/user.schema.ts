import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Schema as MongooseSchema } from 'mongoose';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true }) // adds createdAt (registration date, ACC-14) and updatedAt
export class User {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  // ACC-01: unique email. The unique index makes MongoDB reject duplicates.
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // GEN-13: only a salted hash is stored, never the password
  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, trim: true })
  phone?: string;

  // ACC-09: preferred display currency
  @Prop({ type: String, default: 'USD' })
  preferredCurrency: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.USER })
  role: Role;

  @Prop({ type: String, enum: Object.values(UserStatus), default: UserStatus.ACTIVE })
  status: UserStatus;

  // ACC-13: a moderator is linked to exactly one hotel or airline
  @Prop({ type: MongooseSchema.Types.ObjectId })
  providerId?: Types.ObjectId;

  // ACC-12: the real name is kept here when the account is deactivated and the name becomes 'Deleted user'   // NEW
  @Prop({ type: String })                                                                                     // NEW
  originalName?: string;                                                                                      // NEW

  // ACC-05: lockout after 5 failed logins for 15 minutes
  @Prop({ type: Number, default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date })
  lockUntil?: Date;

  // ACC-07a, ACC-13: temporary passwords must be changed at next login
  @Prop({ type: Boolean, default: false })
  mustChangePassword: boolean;

  // ACC-06: the refresh token is stored (hashed) so logout can revoke it
  @Prop({ type: String })
  refreshTokenHash?: string;

  // ACC-06: sessions expire after 30 minutes without activity
  @Prop({ type: Date })
  lastActivityAt?: Date;

  // ACC-01: consent to terms and privacy, stored with a timestamp
  @Prop({ type: Date })
  consentAcceptedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);