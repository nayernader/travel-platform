import type { Page } from "@/lib/types";
import type { Cabin, Tier } from "@/lib/types-airlines";

/** One item of GET /flights/search (flights.service.ts searchOneWay + toFlightView) */
export interface FlightResult {
  _id: string;
  airline: string;
  /** Not sent yet: needs the small backend patch below */
  airlineName?: string | null;
  airlineCode?: string | null;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
  departureLocal: string;
  departureTimeZone: string;
  arrivalLocal: string;
  arrivalTimeZone: string;
  status: string;
  /** Only the cabins that match passengers, cabin and price filters */
  cabins: Cabin[];
  fromPrice: number;
  durationMinutes: number;
}

/** GET /flights/:id (findOneView) */
export interface FlightDetails extends Omit<FlightResult, "fromPrice"> {
  airlineName: string | null;
  airlineCode: string | null;
  cancellationPolicy: Tier[];
}

export type FlightList = Page<FlightResult>;
export interface RoundTripResponse {
  outbound: FlightList;
  return: FlightList;
}
export type FlightSearchResponse = FlightList | RoundTripResponse;

export function isRoundTrip(d: FlightSearchResponse): d is RoundTripResponse {
  return "outbound" in d && "return" in d;
}

/** Values match the backend CabinClass enum */
export const CABINS = ["Economy", "Premium Economy", "Business", "First"] as const;

/** The URL is the single source of truth (GEN-14). */
export interface FlightQuery {
  from: string;
  to: string;
  date: string;
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  min: string;
  max: string;
  sort: "price" | "duration" | "departureTime";
  page: number;
}

export function parseQuery(p: URLSearchParams): FlightQuery {
  const n = (k: string, d: number) => {
    const v = Number(p.get(k));
    return Number.isFinite(v) && p.get(k) !== null ? v : d;
  };
  return {
    from: p.get("from") ?? "",
    to: p.get("to") ?? "",
    date: p.get("date") ?? "",
    returnDate: p.get("returnDate") ?? "",
    // the home booking bar sends ?passengers=1 -> treat as adults
    adults: n("adults", n("passengers", 1)),
    children: n("children", 0),
    infants: n("infants", 0),
    cabin: p.get("cabin") ?? "",
    min: p.get("min") ?? "",
    max: p.get("max") ?? "",
    sort: (p.get("sort") as FlightQuery["sort"]) ?? "price",
    page: n("page", 1),
  };
}

export function toSearchString(q: Partial<FlightQuery>): string {
  const s = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== 0 && !(k === "page" && v === 1)) s.set(k, String(v));
  });
  if (q.adults) s.set("adults", String(q.adults));
  return s.toString();
}

/** Maps the URL to the backend's SearchFlightsDto. Adults and children occupy seats; infants do not. */
export function toApiParams(q: FlightQuery) {
  const p: Record<string, string | number> = {
    departureAirport: q.from,
    arrivalAirport: q.to,
    date: q.date,
    passengers: q.adults + q.children,
    sortBy: q.sort,
    sortOrder: "ascending",
    page: q.page,
  };
  if (q.returnDate) p.returnDate = q.returnDate;
  if (q.cabin) p.cabinClass = q.cabin;
  if (q.min) p.minPrice = Number(q.min);
  if (q.max) p.maxPrice = Number(q.max);
  return p;
}