import type { BookingStatus, Page } from "@/lib/types";
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

export type PassengerKind = "ADULT" | "CHILD" | "INFANT";

export interface PassengerPayload {
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  type: PassengerKind;
  extraBags?: number;
  extraBagWeightKg?: number;
}

export interface BookingRequest {
  segments: { flightId: string; cabinClass: string }[];
  passengers: PassengerPayload[];
}

export interface SummarySegment {
  flightId: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeUtc: string;
  cabinClass: string;
  farePerSeat: number;
  subtotal: number;
}

export interface BookingSummary {
  adults: number;
  children: number;
  infants: number;
  seats: number;
  passengers: { fullName: string; type: PassengerKind; extraBags: number; extraBagWeightKg: number }[];
  segments: SummarySegment[];
  baggageFee: number;
  total: number;
  currency: string;
}

export interface HoldResponse extends BookingSummary {
  bookingId: string;
  status: string;
  holdExpiresAt: string;
}

/* ---------- My flight bookings (FLT-23 / 25 / 26) ---------- */

export interface BookingFlight {
  _id: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeUtc: string;
  arrivalTimeUtc: string;
}

export interface BookingSegment {
  flight: BookingFlight;
  cabinClass: string;
  unitPrice: number;
}

export interface BookingPassenger {
  fullName: string;
  dateOfBirth: string;
  passportNumber: string;
  type: PassengerKind;
  extraBags?: number;
  extraBagWeightKg?: number;
}

export interface FlightBooking {
  _id: string;
  reference?: string;
  segments: BookingSegment[];
  passengers: BookingPassenger[];
  seats: number;
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  holdExpiresAt?: string;
  cancelledBy?: "USER" | "AIRLINE";
  refundPercent?: number;
  cancelledAt?: string;
  pendingChange?: PendingChange | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingList {
  group: string;
  items: FlightBooking[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type BookingGroup = "upcoming" | "past" | "cancelled";
export const BOOKING_GROUPS: { value: BookingGroup; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

export function parseGroup(v: string | null): BookingGroup {
  return v === "past" || v === "cancelled" ? v : "upcoming";
}

/** segments[0] is the outbound flight */
export function hasDeparted(b: FlightBooking, now: number): boolean {
  const out = b.segments[0]?.flight.departureTimeUtc;
  return !!out && new Date(out).getTime() <= now;
}

export interface RefundPreview {
  bookingId: string;
  reference?: string;
  totalPrice: number;
  currency: string;
  daysRemaining: number;
  refundPercent: number;
  refundAmount: number;
}

export interface CancelResult {
  bookingId: string;
  reference?: string;
  status: "CANCELLED";
  refundPercent: number;
  refundAmount: number;
  currency: string;
}

/* ---------- Change booking (FLT-27) ---------- */

export interface PendingChange {
  changeId: string;
  segments: { flight: string; cabinClass: string; unitPrice: number }[];
  totalPrice: number;
  fareDifference: number;
  status: "PENDING_PAYMENT" | "PENDING_REFUND";
  expiresAt?: string;
}

export interface ChangeRequest {
  segments: { flightId: string; cabinClass: string }[];
}

export interface ChangePreviewSegment {
  flightId: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTimeUtc: string;
  cabinClass: string;
  farePerSeat: number;
  subtotal: number;
}

export interface ChangePreview {
  bookingId: string;
  reference?: string;
  currentTotal: number;
  newTotal: number;
  fareDifference: number;
  currency: string;
  seats: number;
  segments: ChangePreviewSegment[];
  baggageFee: number;
}

export interface ChangeResult extends ChangePreview {
  changeId: string;
  /** COMPLETED: new flights already applied. PENDING_PAYMENT: fare difference must be paid before expiresAt. */
  status: "COMPLETED" | "PENDING_PAYMENT";
  expiresAt?: string;
  paymentRequired: boolean;
  refundDue: number;
}

/** Eligible for FLT-27: confirmed, no pending change, outbound not departed. */
export function canChange(b: FlightBooking, now: number): boolean {
  return b.status === "CONFIRMED" && !b.pendingChange && !hasDeparted(b, now);
}


export function changePaymentHref(bookingId: string, changeId: string): string {
  return `/checkout/flight/${bookingId}?changeId=${changeId}`;
}

/* ---------- Seat selection (FLT-28) ---------- */

export interface SeatMapSeat {
  seatNumber: string;
  status: "AVAILABLE" | "TAKEN";
}

/** GET /flights/:id/seat-map?cabinClass= (flights.service.ts seatMap) */
export interface SeatMapResponse {
  flightId: string;
  flightNumber: string;
  cabinClass: string;
  totalSeats: number;
  takenSeats: number;
  seats: SeatMapSeat[];
}

/** GET /flight-bookings/:id/seats (flight-bookings.service.ts getSeats) */
export interface SeatAssignment {
  flightId: string;
  cabinClass: string;
  passengerIndex: number;
  passengerName: string | null;
  seatNumber: string;
}

export interface SeatsResponse {
  bookingId: string;
  assignments: SeatAssignment[];
}