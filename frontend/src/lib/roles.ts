import type { Role } from "./types";

/** ACC-04: where each role lands after login (and the logo link for moderators and admins). */
export function homeFor(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "airline_moderator":
      return "/dashboard/airline";
    case "hotel_moderator":
      return "/dashboard/hotel";
    default:
      return "/";
  }
}

/** ACC-10: the ?next= page to return to after login. Only local paths ("/x", never "//evil.com" or "https://..."). */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/** Send a guest to login and bring them back here afterwards (ACC-10). */
export function loginUrl(returnTo: string): string {
  return `/login?next=${encodeURIComponent(returnTo)}`;
}
