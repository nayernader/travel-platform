"use client";

import { Suspense, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/use-api";
import { useAuth } from "@/context/auth-context";
import { loginUrl } from "@/lib/roles";
import { formatDuration, formatLocalTime, formatMoney } from "@/lib/format";
import type { Cabin } from "@/lib/types-airlines";
import type { FlightDetails } from "@/lib/types-flights";
import { FormErrors } from "@/components/form-errors";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/ui";

/** Whole number >= 0 from the URL, otherwise the fallback. */
function intParam(sp: URLSearchParams, key: string, fallback: number): number {
  const raw = sp.get(key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

/** Date in the airport's own time zone (GEN-06). */
function dateIn(utc: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(utc));
}

function FlightSummary({ title, flight }: { title: string; flight: FlightDetails }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {flight.airlineName} ({flight.airlineCode}) · {flight.flightNumber}
          </h2>
        </div>
        {flight.status !== "SCHEDULED" && <Badge>{flight.status}</Badge>}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div>
          <p className="text-2xl font-semibold text-slate-900">{formatLocalTime(flight.departureTimeUtc, flight.departureTimeZone)}</p>
          <p className="text-sm text-slate-700">{flight.departureAirport}</p>
          <p className="text-xs text-slate-500">
            {dateIn(flight.departureTimeUtc, flight.departureTimeZone)} · {flight.departureTimeZone}
          </p>
        </div>
        <div className="text-sm text-slate-500 sm:text-center">{formatDuration(flight.durationMinutes)}</div>
        <div className="sm:text-right">
          <p className="text-2xl font-semibold text-slate-900">{formatLocalTime(flight.arrivalTimeUtc, flight.arrivalTimeZone)}</p>
          <p className="text-sm text-slate-700">{flight.arrivalAirport}</p>
          <p className="text-xs text-slate-500">
            {dateIn(flight.arrivalTimeUtc, flight.arrivalTimeZone)} · {flight.arrivalTimeZone}
          </p>
        </div>
      </div>
    </Card>
  );
}

function CabinPicker({
  flight,
  seatsNeeded,
  infants,
  selected,
  onSelect,
}: {
  flight: FlightDetails;
  seatsNeeded: number;
  infants: number;
  selected: string | null;
  onSelect: (cabinClass: string) => void;
}) {
  const flightOpen = flight.status === "SCHEDULED";
  return (
    <Card>
      <CardTitle>Choose a cabin · {flight.flightNumber}</CardTitle>
      {!flightOpen && (
        <div className="mt-3">
          <Alert tone="warning">
            This flight is {flight.status.toLowerCase()} and cannot be booked.
          </Alert>
        </div>
      )}
      {flight.cabins.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">This flight has no cabins.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {flight.cabins.map((c: Cabin) => {
            const enough = c.availableSeats >= seatsNeeded;
            const ok = flightOpen && enough;
            const isSelected = selected === c.cabinClass;
            return (
              <li key={c._id}>
                <button
                  type="button"
                  disabled={!ok}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(c.cabinClass)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{c.cabinClass}</span>
                    <span className="font-semibold text-brand-700">{formatMoney(c.price)}</span>
                  </div>
                  <p className="text-xs text-slate-500">per adult / child</p>
                  <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                    <li>
                      {c.availableSeats} of {c.totalSeats} seats left
                    </li>
                    <li>
                      {c.freeBags} free bag{c.freeBags === 1 ? "" : "s"} · up to {c.maxBagWeightKg} kg each
                    </li>
                  </ul>
                  {flightOpen && !enough && (
                    <p className="mt-2 text-sm text-red-700">
                      Not enough seats for {seatsNeeded} passenger{seatsNeeded === 1 ? "" : "s"}.
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {infants > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Infants pay 10% of the cabin fare and do not take a seat.
        </p>
      )}
    </Card>
  );
}

function CancellationPolicy({ flight, roundTrip }: { flight: FlightDetails; roundTrip: boolean }) {
  // Same rule as backend cancellation.util.ts: the tier with the highest daysBefore
  // that does not exceed the days remaining applies; no tier applies -> 0%.
  const tiers = [...flight.cancellationPolicy].sort((a, b) => b.daysBefore - a.daysBefore);
  const lowest = tiers.length ? tiers[tiers.length - 1].daysBefore : null;
  return (
    <Card>
      <CardTitle>Cancellation policy · {flight.airlineName}</CardTitle>
      {tiers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">No refund is given when a booking is cancelled.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {tiers.map((t) => (
            <li key={t.daysBefore} className="flex items-center justify-between gap-3 py-2">
              <span className="text-slate-700">
                {t.daysBefore === 0 ? "Any time before departure" : `${t.daysBefore} or more days before departure`}
              </span>
              <span className="font-semibold text-brand-700">{t.refundPercent}% refund</span>
            </li>
          ))}
          {lowest !== null && lowest > 0 && (
            <li className="flex items-center justify-between gap-3 py-2">
              <span className="text-slate-700">Less than {lowest} days before departure</span>
              <span className="font-semibold text-slate-900">0% refund</span>
            </li>
          )}
        </ul>
      )}
      {roundTrip && (
        <p className="mt-3 text-sm text-slate-600">
          A round trip is cancelled as a whole, using the outbound flight&apos;s policy above.
        </p>
      )}
    </Card>
  );
}

function FlightDetailsContent() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const adults = Math.max(1, intParam(sp, "adults", 1));
  const children = intParam(sp, "children", 0);
  const infants = intParam(sp, "infants", 0);
  const seatsNeeded = adults + children;
  const returnId = sp.get("return");
  const roundTrip = Boolean(returnId);

  const out = useApi<FlightDetails>(`/flights/${id}`);
  const ret = useApi<FlightDetails>(returnId ? `/flights/${returnId}` : null);

  const [pickOut, setPickOut] = useState<string | null>(null);
  const [pickRet, setPickRet] = useState<string | null>(null);

  const bookable = (f: FlightDetails | null | undefined, cls: string | null): string | null => {
    if (!f || !cls || f.status !== "SCHEDULED") return null;
    const c = f.cabins.find((x) => x.cabinClass === cls);
    return c && c.availableSeats >= seatsNeeded ? cls : null;
  };

  // A click wins; otherwise the cabin filter / earlier choice from the URL if it can be booked.
  const cabinOut = bookable(out.data, pickOut) ?? bookable(out.data, sp.get("cabin"));
  const cabinRet = bookable(ret.data, pickRet) ?? bookable(ret.data, sp.get("returnCabin"));

  const ready = cabinOut !== null && (!roundTrip || cabinRet !== null);

  function handleBook() {
    if (!cabinOut) return;
    if (roundTrip && !cabinRet) return;

    // Where to come back to after login, with the chosen cabins kept (ACC-10).
    const here = new URLSearchParams(sp.toString());
    here.set("cabin", cabinOut);
    if (roundTrip && cabinRet) here.set("returnCabin", cabinRet);
    if (!user) {
      router.push(loginUrl(`${pathname}?${here.toString()}`));
      return;
    }

    const q = new URLSearchParams({
      flight: id,
      cabin: cabinOut,
      adults: String(adults),
      children: String(children),
      infants: String(infants),
    });
    if (roundTrip && returnId && cabinRet) {
      q.set("returnFlight", returnId);
      q.set("returnCabin", cabinRet);
    }
    router.push(`/flights/book?${q.toString()}`);
  }

  const loading = out.loading || (roundTrip && ret.loading);
  const hasErrors = (out.errors?.length ?? 0) > 0 || (roundTrip && (ret.errors?.length ?? 0) > 0);

  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  if (hasErrors || !out.data || (roundTrip && !ret.data)) {
    return (
      <PageContainer>
        <PageHeader title="Flight details" />
        <div className="space-y-4">
          <FormErrors messages={[...(out.errors ?? []), ...(roundTrip ? (ret.errors ?? []) : [])]} />
          <EmptyState
            title="We could not load this flight"
            description="It may have been removed, or the link is not valid."
            action={<ButtonLink href="/flights">Search flights</ButtonLink>}
          />
          <Button variant="outline" onClick={() => { out.reload(); if (roundTrip) ret.reload(); }}>
            Try again
          </Button>
        </div>
      </PageContainer>
    );
  }

  const outbound = out.data;
  const returning = ret.data;

  return (
    <PageContainer>
      <PageHeader
        title={roundTrip ? "Your round trip" : "Flight details"}
        description={`${adults} adult${adults === 1 ? "" : "s"}${children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}${infants ? ` · ${infants} infant${infants === 1 ? "" : "s"}` : ""}`}
        actions={<ButtonLink href="/flights" variant="outline">Back to search</ButtonLink>}
      />

      <div className="space-y-5">
        <FlightSummary title={roundTrip ? "Outbound" : "Flight"} flight={outbound} />
        <CabinPicker
          flight={outbound}
          seatsNeeded={seatsNeeded}
          infants={infants}
          selected={cabinOut}
          onSelect={setPickOut}
        />

        {roundTrip && returning && (
          <>
            <FlightSummary title="Return" flight={returning} />
            <CabinPicker
              flight={returning}
              seatsNeeded={seatsNeeded}
              infants={infants}
              selected={cabinRet}
              onSelect={setPickRet}
            />
          </>
        )}

        <CancellationPolicy flight={outbound} roundTrip={roundTrip} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            {ready
              ? roundTrip
                ? "Both cabins selected."
                : `Cabin selected: ${cabinOut}.`
              : roundTrip
                ? "Select a cabin for each flight to continue."
                : "Select a cabin to continue."}
          </p>
          <Button size="lg" onClick={handleBook} disabled={!ready || authLoading}>
            Book now
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export default function FlightDetailsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FlightDetailsContent />
    </Suspense>
  );
}