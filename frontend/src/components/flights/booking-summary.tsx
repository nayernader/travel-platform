"use client";

import { formatLocalTime, formatMoney } from "@/lib/format";
import type { BookingSummary as Summary, FlightDetails } from "@/lib/types-flights";
import { Card, CardTitle } from "@/components/ui";
import { TYPE_LABEL } from "./passenger-fields";


/** FLT-21: flight, passengers, baggage and total before payment. */
export function BookingSummary({ summary, flights }: { summary: Summary; flights: FlightDetails[] }) {
  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>{summary.segments.length === 2 ? "Your round trip" : "Your flight"}</CardTitle>
        <ul className="mt-3 divide-y divide-slate-100">
          {summary.segments.map((s, i) => {
            const f = flights.find((x) => x._id === s.flightId);
            return (
              <li key={s.flightId} className="py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {summary.segments.length === 2 ? (i === 0 ? "Outbound" : "Return") : "Flight"} · {s.cabinClass}
                </p>
                <p className="font-semibold text-slate-900">
                  {f ? `${f.airlineName} · ` : ""}
                  {s.flightNumber} · {s.departureAirport} → {s.arrivalAirport}
                </p>
                {f && (
                  <p className="text-sm text-slate-600">
                    {formatLocalTime(f.departureTimeUtc, f.departureTimeZone)} ({f.departureAirport}) → {formatLocalTime(f.arrivalTimeUtc, f.arrivalTimeZone)} ({f.arrivalAirport})
                  </p>
                )}
                <p className="mt-1 text-sm text-slate-700">
                  {formatMoney(s.farePerSeat, summary.currency)} × {summary.seats} seat{summary.seats === 1 ? "" : "s"}
                  {summary.infants > 0 && ` + ${summary.infants} infant${summary.infants === 1 ? "" : "s"} at 10%`}
                  {" = "}
                  <span className="font-semibold">{formatMoney(s.subtotal, summary.currency)}</span>
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardTitle>Passengers</CardTitle>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {summary.passengers.map((p, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium text-slate-900">{p.fullName}</span>
              <span className="text-slate-600">
                {TYPE_LABEL[p.type]}
                {p.extraBags > 0 && ` · ${p.extraBags} extra bag${p.extraBags === 1 ? "" : "s"} × ${p.extraBagWeightKg} kg`}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Total</CardTitle>
        <dl className="mt-3 space-y-1 text-sm">
          {summary.segments.map((s) => (
            <div key={s.flightId} className="flex justify-between">
              <dt className="text-slate-600">Fares · {s.flightNumber}</dt>
              <dd className="text-slate-900">{formatMoney(s.subtotal, summary.currency)}</dd>
            </div>
          ))}
          <div className="flex justify-between">
            <dt className="text-slate-600">Extra baggage</dt>
            <dd className="text-slate-900">{formatMoney(summary.baggageFee, summary.currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
            <dt className="font-semibold text-slate-900">Total to pay</dt>
            <dd className="text-xl font-semibold text-brand-700">{formatMoney(summary.total, summary.currency)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}