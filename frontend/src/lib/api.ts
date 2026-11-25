import type { ApiErrorBody } from "./types";

/**
 * The one way to call the backend from Client Components ("use client").
 * - Same origin: /api is forwarded to the NestJS backend (next.config.ts), so the httpOnly cookies are sent automatically.
 * - On 401 it tries POST /api/auth/refresh once, then repeats the request (the access cookie lasts 15 minutes).
 * - On 403 PASSWORD_CHANGE_REQUIRED it sends the user to /change-password (ACC-13).
 * - Errors are thrown as ApiError with the backend's status, code and messages.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly messages: string[];

  constructor(status: number, body: ApiErrorBody | null) {
    const messages = body ? (Array.isArray(body.message) ? body.message : [body.message]) : [];
    super(messages[0] ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.code;
    this.messages = messages.length ? messages : [this.message];
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
}

// These must never trigger the automatic refresh (it would loop or hide a wrong password)
const NO_REFRESH = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

function buildUrl(path: string, query?: Query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
}

async function send(path: string, { method = "GET", body, query }: RequestOptions) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  return fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await send(path, options);

  if (res.status === 401 && !NO_REFRESH.includes(path)) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) res = await send(path, options);
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const error = new ApiError(res.status, data as ApiErrorBody | null);
    if (
      error.code === "PASSWORD_CHANGE_REQUIRED" &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/change-password"
    ) {
      // Outside React here, so a full page navigation is the simplest safe redirect
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/change-password");
    }
    throw error;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Image uploads (GEN-08): pass a FormData with the files under the field name the backend expects. */
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: "POST", body: form }),
};

/** Turns any thrown error into lines to show under a form. */
export function errorMessages(error: unknown): string[] {
  if (error instanceof ApiError) return error.messages;
  if (error instanceof Error) return [error.message];
  return ["Something went wrong"];
}
