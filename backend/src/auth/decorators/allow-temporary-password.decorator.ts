import { SetMetadata } from '@nestjs/common';

export const ALLOW_TEMP_PASSWORD_KEY = 'allowTemporaryPassword';

/**
 * Lets a user who still has a temporary password (mustChangePassword = true) call this route.
 * Every other @Auth() route returns 403 PASSWORD_CHANGE_REQUIRED for them (ACC-07a, ACC-13).
 */
export const AllowTemporaryPassword = () => SetMetadata(ALLOW_TEMP_PASSWORD_KEY, true);
