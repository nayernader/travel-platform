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
