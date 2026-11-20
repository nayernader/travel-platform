
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  INACTIVITY_LIMIT_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_LOGINS,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from '../common/constants/auth.constants';
import { UserStatus } from '../common/enums/user-status.enum';
import { MailService } from '../mail/mail.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const VERIFICATION_RESEND_MS = 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private newToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const token = this.newToken();

    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      consentAcceptedAt: new Date(),
      emailVerified: false,
      emailVerificationTokenHash: this.hash(token),
      emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      emailVerificationSentAt: new Date(),
    });

    const emailSent = await this.mail.sendVerificationEmail(
      user.email,
      user.name,
      token,
    );

    return {
      user: this.users.toResponse(user),
      verificationEmailSent: emailSent,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const invalid = new BadRequestException(
      'The verification link is invalid or has expired',
    );

    const user = await this.users.findByEmailWithVerification(dto.email);

    if (!user || user.emailVerified) {
      throw invalid;
    }

    if (
      !user.emailVerificationTokenHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() <= Date.now()
    ) {
      throw invalid;
    }

    const tokenHash = this.hash(dto.token);

    if (tokenHash !== user.emailVerificationTokenHash) {
      throw invalid;
    }

    const verified = await this.users.markEmailVerified(
      user.id,
      tokenHash,
    );

    if (!verified) {
      throw invalid;
    }

    return {
      verified: true,
      message: 'Your email address is verified',
    };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const generic = {
      message:
        'If the account exists and is not verified, a new verification link was sent',
    };

    const user = await this.users.findByEmailWithVerification(dto.email);

    if (!user || user.emailVerified) {
      return generic;
    }

    if (
      user.emailVerificationSentAt &&
      Date.now() - user.emailVerificationSentAt.getTime() <
        VERIFICATION_RESEND_MS
    ) {
      throw new HttpException(
        'Please wait a minute before requesting another verification link',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = this.newToken();

    await this.users.updateById(user.id, {
      $set: {
        emailVerificationTokenHash: this.hash(token),
        emailVerificationExpiresAt: new Date(
          Date.now() + VERIFICATION_TTL_MS,
        ),
        emailVerificationSentAt: new Date(),
      },
    });

    await this.mail.sendVerificationEmail(user.email, user.name, token);

    return generic;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = {
      message:
        'If an account with that email exists, a password reset link was sent',
    };

    const user = await this.users.findByEmailWithReset(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      return generic;
    }

    if (
      user.passwordResetSentAt &&
      Date.now() - user.passwordResetSentAt.getTime() <
        RESET_COOLDOWN_MS
    ) {
      return generic;
    }

    const token = this.newToken();

    await this.users.updateById(user.id, {
      $set: {
        passwordResetTokenHash: this.hash(token),
        passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
        passwordResetSentAt: new Date(),
      },
    });

    await this.mail.sendPasswordResetLink(user.email, user.name, token);

    return generic;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const invalid = new BadRequestException(
      'The password reset link is invalid or has expired',
    );

    const user = await this.users.findByEmailWithReset(dto.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw invalid;
    }

    if (
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now()
    ) {
      throw invalid;
    }

    const tokenHash = this.hash(dto.token);

    if (tokenHash !== user.passwordResetTokenHash) {
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const done = await this.users.completePasswordReset(
      user.id,
      tokenHash,
      passwordHash,
    );

    if (!done) {
      throw invalid;
    }

    return {
      reset: true,
      message: 'Your password was changed. Log in with your new password.',
    };
  }

  async login(dto: LoginDto, res: Response) {
    const invalid = new UnauthorizedException('Invalid email or password');
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      throw invalid;
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutes = Math.ceil(
        (user.lockUntil.getTime() - Date.now()) / 60000,
      );

      throw new HttpException(
        `Account locked after too many failed attempts. Try again in ${minutes} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordOk = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;

      if (attempts >= MAX_FAILED_LOGINS) {
        await this.users.updateById(user.id, {
          failedLoginAttempts: 0,
          lockUntil: new Date(Date.now() + LOCK_DURATION_MS),
        });

        throw new HttpException(
          'Too many failed attempts. Your account is locked for 15 minutes.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      await this.users.updateById(user.id, {
        failedLoginAttempts: attempts,
      });

      throw invalid;
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account is suspended');
    }

    if (user.status === UserStatus.DEACTIVATED) {
      throw invalid;
    }

    await this.issueTokens(user, res, true);

    return { user: this.users.toResponse(user) };
  }

  async changePassword(
    user: UserDocument,
    dto: ChangePasswordDto,
    res: Response,
  ) {
    const full = await this.users.findById(user.id);

    if (!full) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (!(await bcrypt.compare(dto.currentPassword, full.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (await bcrypt.compare(dto.newPassword, full.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.users.updateById(user.id, {
      $set: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await this.issueTokens(full, res, false);

    return { changed: true };
  }

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (!token) {
      throw new UnauthorizedException('No refresh token');
    }

    let payload: { sub: string };

    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findById(payload.sub);

    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      user.refreshTokenHash !== this.hash(token)
    ) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    if (
      user.lastActivityAt &&
      Date.now() - user.lastActivityAt.getTime() > INACTIVITY_LIMIT_MS
    ) {
      throw new UnauthorizedException(
        'Session expired due to inactivity',
      );
    }

    await this.issueTokens(user, res, false);

    return { message: 'Session refreshed' };
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });

        await this.users.updateById(payload.sub, {
          $unset: { refreshTokenHash: 1 },
        });
      } catch {
        // Invalid or expired token: nothing to revoke.
      }
    }

    res.clearCookie(ACCESS_COOKIE, this.cookieOptions('/', 0));
    res.clearCookie(
      REFRESH_COOKIE,
      this.cookieOptions('/api/auth', 0),
    );

    return { message: 'Logged out' };
  }

  private async issueTokens(
    user: UserDocument,
    res: Response,
    touchActivity: boolean,
  ) {
    const payload = {
      sub: user.id,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TTL_SECONDS,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TTL_SECONDS,
      }),
    ]);

    const $set: Record<string, unknown> = {
      refreshTokenHash: this.hash(refreshToken),
      failedLoginAttempts: 0,
    };

    if (touchActivity) {
      $set.lastActivityAt = new Date();
    }

    await this.users.updateById(user.id, {
      $set,
      $unset: { lockUntil: 1 },
    });

    res.cookie(
      ACCESS_COOKIE,
      accessToken,
      this.cookieOptions('/', ACCESS_TTL_SECONDS),
    );

    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      this.cookieOptions('/api/auth', REFRESH_TTL_SECONDS),
    );
  }

  private cookieOptions(
    path: string,
    maxAgeSeconds: number,
  ): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') !== 'false',
      sameSite: 'lax',
      path,
      maxAge: maxAgeSeconds * 1000,
    };
  }
}
