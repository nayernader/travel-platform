import { ButtonLink, Card, StatusBadge } from "@/components/ui";
import { formatLocalTime, formatMoney } from "@/lib/format";
import type { FlightBooking } from "@/lib/types-flights";

export function BookingCard({ b, zoneOf }: { b: FlightBooking; zoneOf: (code: string) => string | undefined }) {
  const n = b.passengers.length;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl">{b.reference ?? "Reference pending"}</h2>
        <StatusBadge status={b.status} />
      </div>

      <div className="mt-3 space-y-3">
        {b.segments.map((s, i) => (
          <div key={s.flight._id + i} className="text-sm">
            <p className="font-medium">
              {s.flight.flightNumber} · {s.flight.departureAirport} to {s.flight.arrivalAirport}
            </p>
            <p className="text-slate-600">
              {formatLocalTime(s.flight.departureTimeUtc, zoneOf(s.flight.departureAirport))}
              {" → "}
              {formatLocalTime(s.flight.arrivalTimeUtc, zoneOf(s.flight.arrivalAirport))}
              {" · "}{s.cabinClass}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-4">
        <p className="text-sm text-slate-600">
          {n} passenger{n === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-brand-700">{formatMoney(b.totalPrice, b.currency)}</span>
        </p>
        <ButtonLink href={`/bookings/flights/${b._id}`} variant="outline" size="sm">View details</ButtonLink>
      </div>
    </Card>
  );
}