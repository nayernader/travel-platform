// Shared formatting helpers: use these instead of writing your own, so every page looks the same (GEN-17).

/** PAY-04: prices, payments and refunds use one platform currency. Pass the currency the backend returns. */
export function formatMoney(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "-";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** "20 Dec 2026" from an ISO date or date-time. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "20 Dec 2026, 14:35" in the viewer's own time zone (for things like "created at"). */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * GEN-06: a flight time shown in the AIRPORT's local time, e.g. formatLocalTime(flight.departureTime, "Africa/Cairo").
 * The backend stores UTC; the time zone comes from the airport (GET /api/reference/airports).
 */
export function formatLocalTime(utc: string | null | undefined, timeZone: string | undefined): string {
  if (!utc) return "-";
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    timeZone: timeZone || "UTC",
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** "3h 20m" from minutes, or from two ISO date-times. */
export function formatDuration(minutesOrStart: number | string, end?: string): string {
  const minutes = typeof minutesOrStart === "number"
    ? minutesOrStart
    : Math.round((new Date(end ?? "").getTime() - new Date(minutesOrStart).getTime()) / 60000);
  if (!Number.isFinite(minutes) || minutes < 0) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "2026-12-20" for <input type="date"> and for search query parameters. */
export function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}
