import { SetMetadata } from '@nestjs/common';

export const REQUIRE_VERIFIED_KEY = 'requireVerifiedEmail';

/** ACC-02: routes marked with this are refused for users whose email is not verified. */
export const RequireVerifiedEmail = () => SetMetadata(REQUIRE_VERIFIED_KEY, true);