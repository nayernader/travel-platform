"use client";

import { Suspense, useState } from "react";
import { useParams } from "next/navigation";
import { CancelBooking } from "@/components/flights/cancel-booking";
import { ChangeBooking, ChangeBookingButton } from "@/components/flights/change-booking";
import { TYPE_LABEL } from "@/components/flights/passenger-fields";
import { useZoneOf } from "@/components/flights/use-zone-of";
import { FormErrors } from "@/components/form-errors";
import { Alert, ButtonLink, Card, CardTitle, EmptyState, LoadingState, StatusBadge } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import type { SeatsResponse } from "@/lib/types-flights";
import { formatDateTime, formatLocalTime, formatMoney } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import {
  changePaymentHref, hasDeparted, canChange,
  type CancelResult, type ChangeResult, type FlightBooking,
} from "@/lib/types-flights";

function DetailsContent() {
  const { id } = useParams<{ id: string }>();
  const bookingId = String(id);
  const zoneOf = useZoneOf();
  const [now] = useState(() => Date.now());
  const [result, setResult] = useState<CancelResult | null>(null);
  const [changed, setChanged] = useState<ChangeResult | null>(null);

  const { data: b, errors, loading, reload } = useApi<FlightBooking>(`/flight-bookings/${bookingId}`);
  const seatsData = useApi<SeatsResponse>(`/flight-bookings/${bookingId}/seats`);

  if (loading && !b) return <LoadingState label="Loading booking..." />;
  if (errors) return <FormErrors messages={errors} />;
  if (!b) {
    return <EmptyState title="Booking not found" action={<ButtonLink href="/bookings/flights">Back to my bookings</ButtonLink>} />;
  }

  const holdActive = !!b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() > now;
  const canDownload = b.status === "CONFIRMED" || b.status === "COMPLETED";
  const pc = b.status === "CONFIRMED" ? b.pendingChange : null;
  const pcActive = !!pc && pc.status === "PENDING_PAYMENT" && (!pc.expiresAt || new Date(pc.expiresAt).getTime() > now);
  const canCancel = b.status === "CONFIRMED" && !b.pendingChange && !hasDeparted(b, now);

  const canSeat =
  (b.status === "PENDING_PAYMENT" && holdActive) || (b.status === "CONFIRMED" && !b.pendingChange && !hasDeparted(b, now));

  return (
    <div className="space-y-4">
      <div>
        <ButtonLink href="/bookings/flights" variant="ghost" size="sm">← Back to my bookings</ButtonLink>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{b.reference ?? "Booking"}</h2>
        <StatusBadge status={b.status} />
      </div>

      {b.status === "PENDING_PAYMENT" && holdActive && (
        <Alert tone="info" title="Payment pending">
          <p>Seats are held until {formatDateTime(b.holdExpiresAt!)}.</p>
          <div className="mt-3">
            <ButtonLink href={`/checkout/flight/${b._id}`}>Continue to payment</ButtonLink>
          </div>
        </Alert>
      )}
      {(b.status === "EXPIRED" || (b.status === "PENDING_PAYMENT" && !holdActive)) && (
        <Alert tone="warning" title="Booking expired">
          <p>The seat hold ran out before payment was completed.</p>
          <div className="mt-3">
            <ButtonLink href="/flights" variant="outline">Search flights again</ButtonLink>
          </div>
        </Alert>
      )}
      {b.status === "CANCELLED" && (
        <Alert tone="warning" title="Booking cancelled">
          <p>
            Cancelled{b.cancelledBy === "AIRLINE" ? " by the airline" : ""}
            {b.cancelledAt ? ` on ${formatDateTime(b.cancelledAt)}` : ""}.
            {typeof b.refundPercent === "number" ? ` Refund: ${b.refundPercent}%.` : ""}
          </p>
        </Alert>
      )}
      {result && (
        <Alert tone="success" title="Booking cancelled">
          <p>Refund of {formatMoney(result.refundAmount, result.currency)} ({result.refundPercent}%) is on its way.</p>
          {/* TODO: <RefundStatus type="flight" id={id} /> from Member 6 (components/payments/refund-status.tsx, merged Dec 4) */}
        </Alert>
      )}

      {pc && pcActive && (
        <Alert tone="info" title="Flight change waiting for payment">
          <p>
            Pay the fare difference of {formatMoney(pc.fareDifference, b.currency)}
            {pc.expiresAt ? ` before ${formatDateTime(pc.expiresAt)}` : ""} to complete the change.
            Your original flights stay booked until then.
          </p>
          <div className="mt-3">
            <ButtonLink href={changePaymentHref(b._id, pc.changeId)}>Pay fare difference</ButtonLink>
          </div>
        </Alert>
      )}
      {pc && !pcActive && (
        <Alert tone="warning" title="Flight change expired">
          <p>The payment time ran out. The new seats are being released and your original flights are unchanged.</p>
        </Alert>
      )}
      {changed?.status === "COMPLETED" && (
        <Alert tone="success" title="Flights changed">
          <p>
            Your booking now has the new flights.
            {changed.refundDue > 0
              ? ` A refund of ${formatMoney(changed.refundDue, changed.currency)} is on its way.`
              : " No extra cost."}
          </p>
          {/* TODO: <RefundStatus type="flight" id={id} /> from Member 6 (when refundDue > 0) */}
        </Alert>
      )}

      <Card>
        <CardTitle>Flights</CardTitle>
        <div className="mt-3 space-y-4">
          {b.segments.map((s, i) => (
            <div key={s.flight._id + i} className="text-sm">
              <p className="font-medium">
                {i === 0 ? "Outbound" : "Return"} · {s.flight.flightNumber} · {s.flight.departureAirport} to {s.flight.arrivalAirport}
              </p>
              <p className="text-slate-600">
                Departs {formatLocalTime(s.flight.departureTimeUtc, zoneOf(s.flight.departureAirport))}
              </p>
              <p className="text-slate-600">
                Arrives {formatLocalTime(s.flight.arrivalTimeUtc, zoneOf(s.flight.arrivalAirport))}
              </p>
              <p className="text-slate-600">Cabin: {s.cabinClass}</p>
              {seatsData.data?.assignments
                .filter((a) => a.flightId === s.flight._id)
                .map((a) => (
                    <p key={a.passengerIndex} className="text-slate-600">
                    Seat {a.seatNumber}: {a.passengerName ?? `Passenger ${a.passengerIndex + 1}`}
                    </p>
                ))}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Passengers</CardTitle>
        <div className="mt-3 space-y-3">
          {b.passengers.map((p, i) => (
            <div key={p.passportNumber + i} className="text-sm">
              <p className="font-medium">{p.fullName} · {TYPE_LABEL[p.type]}</p>
              <p className="text-slate-600">
                Passport {p.passportNumber} · {p.extraBags ?? 0} extra bag{(p.extraBags ?? 0) === 1 ? "" : "s"}
                {p.extraBagWeightKg ? ` (${p.extraBagWeightKg} kg)` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{b.seats} seat{b.seats === 1 ? "" : "s"}</p>
          <p className="font-display text-xl text-brand-700">{formatMoney(b.totalPrice, b.currency)}</p>
        </div>
      </Card>

      {(canDownload || canChange(b, now) || canSeat) && (
        <div className="flex flex-wrap items-center gap-3">
          {canDownload && (
            <a href={`/api/flight-bookings/${b._id}/e-ticket`} className={buttonClasses("primary", "md", "")}>
              Download e-ticket
            </a>
          )}
          <ChangeBookingButton booking={b} now={now} />
          {canSeat && (
                <ButtonLink href={`/bookings/flights/${b._id}/seats`} variant="outline">
                    {seatsData.data?.assignments.length ? "Change seats" : "Choose seats"}
                </ButtonLink>
                )}
        </div>
      )}

      <ChangeBooking
        booking={b}
        now={now}
        zoneOf={zoneOf}
        onChanged={(r) => { setChanged(r); reload(); }}
      />

      {canCancel && (
        <div className="border-t border-sand pt-4">
          <CancelBooking
            booking={b}
            now={now}
            onCancelled={(r) => { setResult(r); reload(); }}
          />
        </div>
      )}
    </div>
  );
}

export default function FlightBookingDetailsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DetailsContent />
    </Suspense>
  );
}