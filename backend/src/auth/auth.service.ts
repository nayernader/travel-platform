import {
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
import { createHash } from 'crypto';
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
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ACC-01
  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email is already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10); // GEN-13: salted hash
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      consentAcceptedAt: new Date(),
      // role is always USER here: nobody can self-register as admin or moderator
    });
    return this.users.toResponse(user);
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