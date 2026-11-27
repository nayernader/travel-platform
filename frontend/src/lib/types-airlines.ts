/** Types and helpers for the airline module (Member 2). */

export interface Airport {
  _id?: string;
  iata?: string;
  code?: string;
  name?: string;
  city?: string;
  cityId?: string;
  country?: string;
  countryCode?: string;
  timezone?: string;
}


export function airportCode(a: Airport): string {
  return String(a.iata ?? a.code ?? a._id ?? "").toUpperCase();
}


export function airportLabel(a: Airport): string {
  const place = a.city ?? a.cityId ?? a.countryCode ?? "";
  return `${airportCode(a)} - ${a.name ?? "Airport"}${place ? ` (${place})` : ""}`;
}

export interface Tier {
  daysBefore: number;
  refundPercent: number;
}

export interface Airline {
  _id: string;
  name: string;
  code: string;
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
  baggagePolicy?: { pricePerExtraBag: number; maxExtraBags: number } | null;
  cancellationPolicy?: Tier[];
}

export interface Cabin {
  _id: string;
  cabinClass: string;
  totalSeats: number;
  availableSeats: number;
  price: number;
  freeBags: number;
  maxBagWeightKg: number;
}

export interface Flight {
  _id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  departureLocal?: string;
  arrivalLocal?: string;
  status: "SCHEDULED" | "CANCELLED" | "DEPARTED";
  cabins: Cabin[];
}

export interface PageOf<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export const CABIN_CLASSES = ["Economy", "Premium Economy", "Business", "First"] as const;

/** GEN-06: shows a UTC time in an airport's own time zone. */
export function formatInZone(utc: string, timeZone?: string): string {
  try {
    return new Date(utc).toLocaleString("en-GB", {
      timeZone: timeZone || "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return utc;
  }
}