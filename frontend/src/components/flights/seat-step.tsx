"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { SeatSegment } from "@/components/flights/seat-segment";
import { Alert, ButtonLink, EmptyState, LoadingState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { FlightBooking, SeatsResponse } from "@/lib/types-flights";

/** FLT-28: seat picking for every flight of a booking. Used before payment and after it. */
export function SeatStep({
  bookingId,
  continueHref,
  continueLabel,
  skipLabel,
}: {
  bookingId: string;
  continueHref: string;
  continueLabel: string;
  skipLabel?: string;
}) {
  const [now] = useState(() => Date.now());
  const booking = useApi<FlightBooking>(`/flight-bookings/${bookingId}`);
  const seats = useApi<SeatsResponse>(`/flight-bookings/${bookingId}/seats`);

  if ((booking.loading && !booking.data) || (seats.loading && !seats.data)) return <LoadingState />;
  if (booking.errors) return <FormErrors messages={booking.errors} />;
  if (seats.errors) return <FormErrors messages={seats.errors} />;

  const b = booking.data;
  const assignments = seats.data?.assignments ?? [];
  if (!b) {
    return <EmptyState title="Booking not found" action={<ButtonLink href="/bookings/flights">My bookings</ButtonLink>} />;
  }

  const holdActive = !!b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() > now;
  const open = (b.status === "PENDING_PAYMENT" && holdActive) || (b.status === "CONFIRMED" && !b.pendingChange);

  return (
    <div className="space-y-5">
      {b.status === "PENDING_PAYMENT" && holdActive && (
        <Alert tone="info">Your seats are held until {formatDateTime(b.holdExpiresAt!)}. Pick seats, then pay.</Alert>
      )}
      {!open && <Alert tone="warning">Seats can only be changed on an active hold or a confirmed booking.</Alert>}

      {b.segments.map((s, i) => (
        <SeatSegment
          key={`${s.flight._id}-${i}-${assignments.length}`}
          booking={b}
          segmentIndex={i}
          current={assignments.filter((a) => a.flightId === s.flight._id)}
          disabled={!open || new Date(s.flight.departureTimeUtc).getTime() <= now}
          onSaved={seats.reload}
        />
      ))}

      <div className="flex flex-wrap justify-between gap-3">
        {skipLabel ? <ButtonLink href={continueHref} variant="outline">{skipLabel}</ButtonLink> : <span />}
        <ButtonLink href={continueHref} size="lg">{continueLabel}</ButtonLink>
      </div>
    </div>
  );
}