/** Types and helpers for the airline module (Member 2). */

export interface Airport {
  _id?: string;       // IATA code, e.g. "CAI"
  iata?: string;
  code?: string;
  name?: string;
  city?: string;
  cityId?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;  // IANA time zone, e.g. "Africa/Cairo"
}

/** Always returns the 3-letter IATA code in upper case. */
export function airportCode(a: Airport): string {
  return String(a.iata ?? a.code ?? a._id ?? "").toUpperCase();
}

/** Human-readable label: "CAI - Cairo International (cairo)". */
export function airportLabel(a: Airport): string {
  const place = a.city ?? a.cityId ?? a.countryCode ?? "";
  return `${airportCode(a)} - ${a.name ?? "Airport"}${place ? ` (${place})` : ""}`;
}