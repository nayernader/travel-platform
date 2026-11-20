import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core'; // NEW
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, INACTIVITY_LIMIT_MS } from '../../common/constants/auth.constants';
import { UserStatus } from '../../common/enums/user-status.enum';
import type { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { ALLOW_TEMP_PASSWORD_KEY } from '../decorators/allow-temporary-password.decorator';
import { REQUIRE_VERIFIED_KEY } from '../decorators/require-verified-email.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly reflector: Reflector, // NEW
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: UserDocument }>();

    // The token comes from the httpOnly cookie (ACC-19), never from JavaScript storage
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Load the user on every request, so a suspension takes effect immediately
    const user = await this.users.findById(payload.sub);
    if (!user || user.status === UserStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account not found');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Your account is suspended');
    }

    // ACC-06: expire the session after 30 minutes without an authenticated request
    const now = Date.now();
    const last = user.lastActivityAt?.getTime();
    if (last && now - last > INACTIVITY_LIMIT_MS) {
      throw new UnauthorizedException('Session expired due to inactivity');
    }
    if (!last || now - last > 60_000) {
      await this.users.updateById(user.id, { lastActivityAt: new Date(now) });
    }

    // NEW: ACC-07a, ACC-13. A temporary password must be changed before anything else.
    // Only routes marked with @AllowTemporaryPassword() are let through.
    if (user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_TEMP_PASSWORD_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Forbidden',
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your temporary password first',
        });
      }
    }
    
    // ACC-02: some routes (booking, payment) need a verified email
    const needsVerified = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (needsVerified && user.emailVerified === false) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address first',
      });
    }
    req.user = user;
    return true;
  }
}