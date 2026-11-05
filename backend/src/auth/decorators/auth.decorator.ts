import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { ROLES_KEY } from './roles.decorator';

/**
 * @Auth()                       any logged-in user
 * @Auth(Role.ADMIN)             admins only
 * @Auth(Role.AIRLINE_MODERATOR) airline moderators only
 */
export function Auth(...roles: Role[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiCookieAuth('access_token'),
    ApiUnauthorizedResponse({ description: 'Not logged in or session expired' }),
    ApiForbiddenResponse({ description: 'Your role is not allowed, the account is suspended, or a temporary password must be changed first (PASSWORD_CHANGE_REQUIRED)' }),  );
}