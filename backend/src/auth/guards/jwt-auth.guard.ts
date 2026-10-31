import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ACCESS_COOKIE, INACTIVITY_LIMIT_MS } from '../../common/constants/auth.constants';
import { UserStatus } from '../../common/enums/user-status.enum';
import type { UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
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

    req.user = user;
    return true;
  }
}