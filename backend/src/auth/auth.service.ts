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
import { createHash, randomInt } from 'crypto';
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
import type { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto'; // NEW
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { MailService } from '../mail/mail.service';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const VERIFICATION_TTL_MS = 15 * 60 * 1000; // ACC-02: the code is valid for 15 minutes
const VERIFICATION_MAX_ATTEMPTS = 5; // wrong tries before the code is thrown away
const VERIFICATION_RESEND_MS = 60 * 1000; // at least 60 seconds between emails

const RESET_TTL_MS = 30 * 60 * 1000; // ACC-07: the code is valid for 30 minutes
const RESET_MAX_ATTEMPTS = 5; // wrong tries before the code is thrown away
const RESET_COOLDOWN_MS = 60 * 1000; // at least 60 seconds between reset emails

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  // ACC-01, ACC-02
  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10); // GEN-13: salted hash
    const code = this.newCode();
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      consentAcceptedAt: new Date(),
      emailVerified: false,
      emailVerificationCodeHash: this.hash(code), // only the hash is stored
      emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
      emailVerificationSentAt: new Date(),
      // role is always USER here: nobody can self-register as admin or moderator
    });

    await this.mail.sendVerificationCode(user.email, user.name, code);
    return this.users.toResponse(user);
  }

  // ACC-02: checks the 6-digit code. Wrong, expired and used codes all get a clear 400.
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.users.findByEmailWithVerification(dto.email);
    const invalid = new BadRequestException('The code is invalid or has expired');
    if (!user) throw invalid; // same answer as a wrong code, so emails are not revealed

    if (user.emailVerified) throw new BadRequestException('This email is already verified');
    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('No active code. Request a new one.');
    }
    if (user.emailVerificationExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('The code has expired. Request a new one.');
    }

    if (this.hash(dto.code) !== user.emailVerificationCodeHash) {
      const attempts = (user.emailVerificationAttempts ?? 0) + 1;
      if (attempts >= VERIFICATION_MAX_ATTEMPTS) {
        await this.users.updateById(user.id, {
          $set: { emailVerificationAttempts: 0 },
          $unset: { emailVerificationCodeHash: 1, emailVerificationExpiresAt: 1 },
        });
        throw new BadRequestException('Too many wrong codes. Request a new one.');
      }
      await this.users.updateById(user.id, { $set: { emailVerificationAttempts: attempts } });
      throw invalid;
    }

    const verified = await this.users.markEmailVerified(user.id);
    if (!verified) throw new BadRequestException('This email is already verified');
    return { verified: true, message: 'Your email address is verified' };
  }

  // ACC-02: sends a new code (the old one stops working). Same answer whether or not the email exists.
  async resendVerification(dto: ResendVerificationDto) {
    const generic = { message: 'If the account exists and is not verified, a new code was sent' };
    const user = await this.users.findByEmailWithVerification(dto.email);
    if (!user || user.emailVerified) return generic;

    if (
      user.emailVerificationSentAt &&
      Date.now() - user.emailVerificationSentAt.getTime() < VERIFICATION_RESEND_MS
    ) {
      throw new HttpException('Please wait a minute before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = this.newCode();
    await this.users.updateById(user.id, {
      $set: {
        emailVerificationCodeHash: this.hash(code),
        emailVerificationExpiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        emailVerificationAttempts: 0,
        emailVerificationSentAt: new Date(),
      },
    });
    await this.mail.sendVerificationCode(user.email, user.name, code);
    return generic;
  }

    // ACC-07: always the same answer, whether or not the email exists or the account can be reset
  async forgotPassword(dto: ForgotPasswordDto) {
    const generic = { message: 'If an account with that email exists, a reset code was sent' };

    const user = await this.users.findByEmailWithReset(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) return generic; // suspended or deactivated: no code

    // too soon after the last email: do nothing, and answer the same (no 429, so nothing is revealed)
    if (user.passwordResetSentAt && Date.now() - user.passwordResetSentAt.getTime() < RESET_COOLDOWN_MS) {
      return generic;
    }

    const code = this.newCode();
    await this.users.updateById(user.id, {
      $set: {
        passwordResetCodeHash: this.hash(code), // only the hash is stored
        passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
        passwordResetAttempts: 0,
        passwordResetSentAt: new Date(),
      },
    });
    await this.mail.sendPasswordResetCode(user.email, user.name, code);
    return generic;
  }

  // ACC-07: checks the code and sets the new password. Wrong, expired and used codes all get a 400.
  async resetPassword(dto: ResetPasswordDto) {
    const invalid = new BadRequestException('The code is invalid or has expired');

    const user = await this.users.findByEmailWithReset(dto.email);
    if (!user || user.status !== UserStatus.ACTIVE) throw invalid; // same answer as a wrong code
    if (!user.passwordResetCodeHash || !user.passwordResetExpiresAt) throw invalid;
    if (user.passwordResetExpiresAt.getTime() <= Date.now()) throw invalid;

    const codeHash = this.hash(dto.code);
    if (codeHash !== user.passwordResetCodeHash) {
      const attempts = (user.passwordResetAttempts ?? 0) + 1;
      if (attempts >= RESET_MAX_ATTEMPTS) {
        await this.users.updateById(user.id, {
          $set: { passwordResetAttempts: 0 },
          $unset: { passwordResetCodeHash: 1, passwordResetExpiresAt: 1 },
        });
        throw new BadRequestException('Too many wrong codes. Request a new one.');
      }
      await this.users.updateById(user.id, { $set: { passwordResetAttempts: attempts } });
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10); // GEN-13: salted hash
    const done = await this.users.completePasswordReset(user.id, codeHash, passwordHash);
    if (!done) throw invalid; // used or expired between the check and the update
    return { reset: true, message: 'Your password was changed. Log in with the new password.' };
  }
  
  // 6 random digits, cryptographically secure, leading zeros kept
  private newCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
  // ACC-04, ACC-05
  async login(dto: LoginDto, res: Response) {
    const invalid = new UnauthorizedException('Invalid email or password'); // generic on purpose
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw invalid;

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(
        `Account locked after too many failed attempts. Try again in ${minutes} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
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
      await this.users.updateById(user.id, { failedLoginAttempts: attempts });
      throw invalid;
    }

    // Status is checked after the password, so only the real owner learns the status
    if (user.status === UserStatus.SUSPENDED) throw new ForbiddenException('Your account is suspended');
    if (user.status === UserStatus.DEACTIVATED) throw invalid;

    await this.issueTokens(user, res, true);
    return { user: this.users.toResponse(user) };
  }

  // ACC-08: change my password with the current one. Also finishes a temporary-password login (ACC-07a, ACC-13). // NEW
  async changePassword(user: UserDocument, dto: ChangePasswordDto, res: Response) { // NEW
    const full = await this.users.findById(user.id); // NEW
    if (!full) throw new UnauthorizedException('Session is no longer valid'); // NEW
    if (!(await bcrypt.compare(dto.currentPassword, full.passwordHash))) { // NEW
      throw new BadRequestException('Current password is incorrect'); // NEW
    } // NEW
    if (await bcrypt.compare(dto.newPassword, full.passwordHash)) { // NEW
      throw new BadRequestException('New password must be different from the current one'); // NEW
    } // NEW
    const passwordHash = await bcrypt.hash(dto.newPassword, 10); // GEN-13: salted hash // NEW
    await this.users.updateById(user.id, { $set: { passwordHash, mustChangePassword: false } }); // NEW
    // New cookies: the refresh token hash is replaced, so older refresh tokens stop working, while this session continues // NEW
    await this.issueTokens(full, res, false); // NEW
    return { changed: true }; // NEW
  } // NEW

  // Issues a new access token from the refresh cookie
  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('No refresh token');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE || user.refreshTokenHash !== this.hash(token)) {
      throw new UnauthorizedException('Session is no longer valid');
    }
    if (user.lastActivityAt && Date.now() - user.lastActivityAt.getTime() > INACTIVITY_LIMIT_MS) {
      throw new UnauthorizedException('Session expired due to inactivity');
    }

    await this.issueTokens(user, res, false);
    return { message: 'Session refreshed' };
  }

  // ACC-06: clears the cookies and revokes the refresh token on the server
  async logout(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        });
        await this.users.updateById(payload.sub, { $unset: { refreshTokenHash: 1 } });
      } catch {
        // expired or invalid: there is nothing to revoke
      }
    }
    res.clearCookie(ACCESS_COOKIE, this.cookieOptions('/', 0));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions('/api/auth', 0));
    return { message: 'Logged out' };
  }

  // ---------- helpers ----------

  private async issueTokens(user: UserDocument, res: Response, touchActivity: boolean) {
    const payload = { sub: user.id, role: user.role };
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
      refreshTokenHash: this.hash(refreshToken), // only a hash of the refresh token is stored
      failedLoginAttempts: 0, // a successful login resets the counter (ACC-05)
    };
    if (touchActivity) $set.lastActivityAt = new Date();
    await this.users.updateById(user.id, { $set, $unset: { lockUntil: 1 } });

    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions('/', ACCESS_TTL_SECONDS));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions('/api/auth', REFRESH_TTL_SECONDS));
  }

  // ACC-19: httpOnly, Secure and SameSite cookies
  private cookieOptions(path: string, maxAgeSeconds: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('COOKIE_SECURE') !== 'false',
      sameSite: 'lax',
      path,
      maxAge: maxAgeSeconds * 1000,
    };
  }

  // SHA-256, not bcrypt: bcrypt only reads the first 72 characters, and tokens are longer
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}