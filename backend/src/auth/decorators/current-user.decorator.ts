import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserDocument } from '../../users/schemas/user.schema';

// Gives a controller method the logged-in user: @CurrentUser() user: UserDocument
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserDocument => {
    return ctx.switchToHttp().getRequest<{ user: UserDocument }>().user;
  },
);