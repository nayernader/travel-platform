"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { SeatMap } from "@/components/flights/seat-map";
import { TYPE_LABEL } from "@/components/flights/passenger-fields";
import { Alert, Button, Card, CardTitle, LoadingState } from "@/components/ui";
import { api, errorMessages } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { FlightBooking, SeatAssignment, SeatMapResponse } from "@/lib/types-flights";

/** FLT-28: seat picker for ONE flight (segment) of a booking. Infants get no seat. */
export function SeatSegment({
  booking,
  segmentIndex,
  current,
  disabled,
  onSaved,
}: {
  booking: FlightBooking;
  segmentIndex: number;
  /** Seats this booking already holds on this flight */
  current: SeatAssignment[];
  disabled?: boolean;
  onSaved: () => void;
}) {
  const seg = booking.segments[segmentIndex];
  const flightId = seg.flight._id;
  const map = useApi<SeatMapResponse>(`/flights/${flightId}/seat-map`, { cabinClass: seg.cabinClass });

  const seated = booking.passengers
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.type !== "INFANT");

  const [chosen, setChosen] = useState<Record<number, string>>(() =>
    Object.fromEntries(current.map((a) => [a.passengerIndex, a.seatNumber])),
  );
  const [active, setActive] = useState<number>(seated[0]?.i ?? 0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function pick(seat: string) {
    setSaved(false);
    setChosen((c) => {
      const next: Record<number, string> = {};
      for (const [k, v] of Object.entries(c)) if (v !== seat) next[Number(k)] = v;
      next[active] = seat;
      return next;
    });
    const nextFree = seated.find(({ i }) => i !== active && !chosen[i]);
    if (nextFree) setActive(nextFree.i);
  }

  async function save() {
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.patch(`/flight-bookings/${booking._id}/seat`, {
        flightId,
        assignments: Object.entries(chosen).map(([i, seatNumber]) => ({ passengerIndex: Number(i), seatNumber })),
      });
      setSaved(true);
      map.reload();
      onSaved();
    } catch (err) {
      setErrors(errorMessages(err)); // e.g. seat taken: nothing was changed (all-or-nothing)
    } finally {
      setBusy(false);
    }
  }

  const bySeat: Record<string, number> = {};
  for (const [i, s] of Object.entries(chosen)) bySeat[s] = Number(i);
  const count = Object.keys(chosen).length;

  return (
    <Card>
      <CardTitle>
        {segmentIndex === 0 ? "Outbound" : "Return"} · {seg.flight.flightNumber} · {seg.flight.departureAirport} to{" "}
        {seg.flight.arrivalAirport} · {seg.cabinClass}
      </CardTitle>

      <div className="mt-3 flex flex-wrap gap-2">
        {seated.map(({ p, i }) => (
          <Button
            key={i}
            type="button"
            size="sm"
            variant={active === i ? undefined : "outline"}
            disabled={disabled}
            onClick={() => setActive(i)}
          >
            {p.fullName || `Passenger ${i + 1}`} ({TYPE_LABEL[p.type]}): {chosen[i] ?? "no seat"}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {map.loading && <LoadingState label="Loading seat map..." />}
        {map.errors && <FormErrors messages={map.errors} />}
        {map.data && (
          <SeatMap
            seats={map.data.seats}
            selected={bySeat}
            own={current.map((a) => a.seatNumber)}
            onPick={pick}
            disabled={disabled || busy}
          />
        )}
      </div>

      <div className="mt-4 space-y-3">
        <FormErrors messages={errors} />
        {saved && <Alert tone="success">Seats saved.</Alert>}
        <Button type="button" loading={busy} disabled={disabled || count === 0} onClick={save}>
          Save seats
        </Button>
      </div>
    </Card>
  );
}