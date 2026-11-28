"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlightRow } from "@/components/flights/flight-row";
import { FormErrors } from "@/components/form-errors";
import {
  Button, Card, CardTitle, ConfirmDialog, EmptyState, Input, LoadingState, Pagination,
} from "@/components/ui";
import { api, errorMessages } from "@/lib/api";
import { formatLocalTime, formatMoney, toDateInput } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import {
  canChange, parseQuery, toApiParams,
  type BookingSegment, type ChangePreview, type ChangeRequest, type ChangeResult,
  type FlightBooking, type FlightList, type FlightResult,
} from "@/lib/types-flights";

type ZoneOf = (code: string) => string | undefined;

function diffText(p: ChangePreview) {
  if (p.fareDifference > 0) return `You pay ${formatMoney(p.fareDifference, p.currency)} more`;
  if (p.fareDifference < 0) return `You get ${formatMoney(-p.fareDifference, p.currency)} back`;
  return "No price difference";
}

function diffNote(p: ChangePreview) {
  if (p.fareDifference > 0) {
    return "The new seats are held for 10 minutes. The change is applied once the difference is paid; until then your original flights stay booked.";
  }
  if (p.fareDifference < 0) return "The new flights are applied immediately and the difference is refunded.";
  return "The new flights are applied immediately.";
}

/** One leg: search alternatives on the same route and cabin (GEN-05, GEN-14 via URL props). */
function SegmentPicker({ index, seg, seats, date, page, picked, zoneOf, onPick, onDate, onPage }: {
  index: number;
  seg: BookingSegment;
  seats: number;
  date: string;
  page: number;
  picked: FlightResult | undefined;
  zoneOf: ZoneOf;
  onPick: (f: FlightResult) => void;
  onDate: (d: string) => void;
  onPage: (p: number) => void;
}) {
  const from = seg.flight.departureAirport;
  const to = seg.flight.arrivalAirport;
  const q = {
    ...parseQuery(new URLSearchParams()),
    from, to, date, adults: seats, cabin: seg.cabinClass, sort: "departureTime" as const, page,
  };
  const { data, errors, loading } = useApi<FlightList>(date ? "/flights/search" : null, toApiParams(q));

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg">{index === 0 ? "Outbound" : "Return"}: {from} to {to}</h3>
      <p className="text-sm text-slate-600">
        Now: {seg.flight.flightNumber}, departs {formatLocalTime(seg.flight.departureTimeUtc, zoneOf(from))} · {seg.cabinClass}
      </p>
      <Input label="Search date" type="date" min={toDateInput(new Date())} value={date}
        onChange={(e) => onDate(e.target.value)} />

      {picked && (
        <p className="text-sm font-medium text-slate-900">
          Selected: {picked.flightNumber}, departs {formatLocalTime(picked.departureTimeUtc, picked.departureTimeZone)}
        </p>
      )}

      {!date && <EmptyState title="Choose a date" description="Pick a date to see other flights on this route." />}
      {loading && <LoadingState label="Searching flights..." />}
      {errors && <FormErrors messages={errors} />}
      {data && !data.items.length && (
        <EmptyState title="No flights found" description="Try another date." />
      )}
      {data?.items.map((f) => {
        const current = f._id === seg.flight._id;
        return (
          <FlightRow key={f._id} f={f} action={
            <Button type="button" size="sm" disabled={current}
              variant={picked?._id === f._id ? undefined : "ghost"} onClick={() => onPick(f)}>
              {current ? "Current flight" : picked?._id === f._id ? "Selected" : "Select"}
            </Button>} />
        );
      })}
      {data && <Pagination page={data.page} total={data.total} onPageChange={onPage} />}
    </div>
  );
}

/** FLT-27: search alternatives -> change-preview -> ConfirmDialog -> change. Panel state lives in the URL (?change=1&d0=&p0=...). */
export function ChangeBooking({ booking, now, zoneOf, onChanged }: {
  booking: FlightBooking;
  now: number;
  zoneOf: ZoneOf;
  onChanged: (r: ChangeResult) => void;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [picked, setPicked] = useState<(FlightResult | undefined)[]>([]);
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (!canChange(booking, now)) return null;

  const open = sp.get("change") === "1";
  const ready = booking.segments.every((_, i) => !!picked[i]);

  function setUrl(patch: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function close() {
    setPicked([]);
    setPreview(null);
    setErrors([]);
    setUrl({ change: null, d0: null, d1: null, p0: null, p1: null });
  }

  const body = (): ChangeRequest => ({
    segments: booking.segments.map((s, i) => ({ flightId: picked[i]!._id, cabinClass: s.cabinClass })),
  });

  async function review() {
    setErrors([]);
    setBusy(true);
    try {
      setPreview(await api.post<ChangePreview>(`/flight-bookings/${booking._id}/change-preview`, body()));
      setConfirmOpen(true);
    } catch (e) {
      setErrors(errorMessages(e)); // GEN-13
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const r = await api.post<ChangeResult>(`/flight-bookings/${booking._id}/change`, body());
      setConfirmOpen(false);
      close();
      onChanged(r);
    } catch (e) {
      setConfirmOpen(false);
      setErrors(errorMessages(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <Card>
      <CardTitle>Change flights</CardTitle>
      <p className="mt-1 text-sm text-slate-600">
        Pick a different flight for each leg. Route and cabin stay the same.
      </p>

      <div className="mt-4 space-y-6">
        {booking.segments.map((s, i) => (
          <SegmentPicker
            key={s.flight._id + i}
            index={i}
            seg={s}
            seats={booking.seats}
            date={sp.get(`d${i}`) ?? toDateInput(new Date(s.flight.departureTimeUtc))}
            page={Number(sp.get(`p${i}`)) || 1}
            picked={picked[i]}
            zoneOf={zoneOf}
            onPick={(f) => setPicked((p) => { const n = [...p]; n[i] = f; return n; })}
            onDate={(d) => setUrl({ [`d${i}`]: d, [`p${i}`]: null })}
            onPage={(p) => setUrl({ [`p${i}`]: String(p) })}
          />
        ))}
      </div>

      {errors.length > 0 && <div className="mt-4"><FormErrors messages={errors} /></div>}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={!ready} loading={busy && !confirmOpen} onClick={review}>
          Review change
        </Button>
        <Button type="button" variant="ghost" onClick={close}>Close</Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Change your flights?"
        confirmLabel="Confirm change"
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setConfirmOpen(false)}
        message={preview && (
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              {preview.segments.map((s, i) => (
                <div key={s.flightId + i}>
                  <p className="font-medium text-slate-900">
                    {i === 0 ? "Outbound" : "Return"} · {s.flightNumber} · {s.departureAirport} to {s.arrivalAirport}
                  </p>
                  <p>Departs {formatLocalTime(s.departureTimeUtc, zoneOf(s.departureAirport))} · {s.cabinClass}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1 border-t border-sand pt-3">
              <p>Current total: {formatMoney(preview.currentTotal, preview.currency)}</p>
              <p>New total: {formatMoney(preview.newTotal, preview.currency)}</p>
              <p>Baggage fee (included): {formatMoney(preview.baggageFee, preview.currency)}</p>
              <p className="font-medium text-brand-700">{diffText(preview)}</p>
            </div>
            <p>{diffNote(preview)}</p>
          </div>
        )}
      />
    </Card>
  );
}

/** The trigger lives in the page's action row; the panel above opens from ?change=1. */
export function ChangeBookingButton({ booking, now }: { booking: FlightBooking; now: number }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  if (!canChange(booking, now) || sp.get("change") === "1") return null;
  const next = new URLSearchParams(sp.toString());
  next.set("change", "1");
  return (
    <Button type="button" variant="outline" onClick={() => router.replace(`${pathname}?${next}`, { scroll: false })}>
      Change flights
    </Button>
  );
}