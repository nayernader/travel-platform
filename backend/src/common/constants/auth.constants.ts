export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const ACCESS_TTL_SECONDS = 15 * 60; // access token lives 15 minutes
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // refresh token lives 7 days
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // ACC-06: 30 minutes without activity
export const MAX_FAILED_LOGINS = 5; // ACC-05
export const LOCK_DURATION_MS = 15 * 60 * 1000; // ACC-05