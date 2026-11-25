// Shapes returned by the backend. Keep in sync with backend DTOs and toResponse().

export type Role = "user" | "admin" | "airline_moderator" | "hotel_moderator";

export type UserStatus = "active" | "suspended" | "deactivated";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  preferredCurrency?: string;
  role: Role;
  status: UserStatus;
  mustChangePassword: boolean;
  /** Moderators only: the id of their ONE airline or hotel */
  providerId?: string;
  createdAt?: string;
}

/** Every list endpoint is paginated by 10 (GEN-05). */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  [key: string]: unknown;
}

/** The error shape produced by the backend's AllExceptionsFilter. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  code?: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}

export const SUPPORTED_CURRENCIES = ["EGP", "AED", "GBP", "USD", "EUR", "JPY", "SAR"] as const;

/** GEN-11: the only statuses a flight booking or hotel reservation can have (values as the backend sends them). */
export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "COMPLETED" | "EXPIRED" | "CANCELLED";

/** Used in shared URLs: /checkout/flight/:id, /checkout/hotel/:id */
export type BookingType = "flight" | "hotel";

// Module types go in their own file next to this one: src/lib/types-flights.ts, types-hotels.ts,
// types-payments.ts, types-itineraries.ts, types-blog.ts, types-admin.ts (one owner each, no merge conflicts).
