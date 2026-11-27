"use client";

import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { loginUrl } from "@/lib/roles";
import { useRouter, useSearchParams } from "next/navigation";
import { api, errorMessages } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { BookingRequest, BookingSummary as Summary, FlightDetails, HoldResponse, PassengerKind } from "@/lib/types-flights";
import { FormErrors } from "@/components/form-errors";
import { RequireAuth } from "@/components/require-auth";
import { BookingSummary } from "@/components/flights/booking-summary";
import { SeatStep } from "@/components/flights/seat-step";
import {
  PassengerFields,
  emptyPassenger,
  validatePassenger,
  type PassengerErrors,
  type PassengerForm,
} from "@/components/flights/passenger-fields";
import { Alert, Button, ButtonLink, Card, EmptyState, LoadingState, PageContainer, PageHeader } from "@/components/ui";

function intParam(sp: URLSearchParams, key: string, fallback: number): number {
  const raw = sp.get(key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

function BookContent() {
  const sp = useSearchParams();

  const flightId = sp.get("flight");
  const cabin = sp.get("cabin");
  const returnId = sp.get("returnFlight");
  const returnCabin = sp.get("returnCabin");
  const adults = intParam(sp, "adults", 1);
  const children = intParam(sp, "children", 0);
  const infants = intParam(sp, "infants", 0);

  const out = useApi<FlightDetails>(flightId ? `/flights/${flightId}` : null);
  const ret = useApi<FlightDetails>(returnId ? `/flights/${returnId}` : null);

  const [passengers, setPassengers] = useState<PassengerForm[]>(() => {
    const kinds: PassengerKind[] = [
      ...Array<PassengerKind>(Math.max(1, adults)).fill("ADULT"),
      ...Array<PassengerKind>(children).fill("CHILD"),
      ...Array<PassengerKind>(infants).fill("INFANT"),
    ];
    return kinds.map(emptyPassenger);
  });
  const [fieldErrors, setFieldErrors] = useState<PassengerErrors[]>([]);
  const [backendErrors, setBackendErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [heldId, setHeldId] = useState<string | null>(null);
  
  const roundTrip = Boolean(returnId);
  const invalidLink =
    !flightId ||
    !cabin ||
    (roundTrip && !returnCabin) ||
    adults < 1 ||
    infants > adults ||
    adults + children > 9 ||
    adults + children + infants > 9;

  if (heldId) {
    return (
        <PageContainer size="md">
        <PageHeader title="Choose your seats" description="Optional. Your booking is held while you choose." />
        <SeatStep
            bookingId={heldId}
            continueHref={`/checkout/flight/${heldId}`}
            continueLabel="Continue to payment"
            skipLabel="Skip to payment"
        />
        </PageContainer>
    );
}

  if (invalidLink) {
    return (
      <PageContainer>
        <EmptyState
          title="This booking link is not complete"
          description="Choose a flight and a cabin first."
          action={<ButtonLink href="/flights">Search flights</ButtonLink>}
        />
      </PageContainer>
    );
  }

  const loading = out.loading || (roundTrip && ret.loading);
  if (loading) {
    return (
      <PageContainer>
        <LoadingState />
      </PageContainer>
    );
  }

  const loadErrors = [...(out.errors ?? []), ...(roundTrip ? (ret.errors ?? []) : [])];
  if (loadErrors.length > 0 || !out.data || (roundTrip && !ret.data)) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <FormErrors messages={loadErrors} />
          <EmptyState
            title="We could not load this flight"
            description="It may have been removed, or the link is not valid."
            action={<ButtonLink href="/flights">Search flights</ButtonLink>}
          />
        </div>
      </PageContainer>
    );
  }

  const outbound = out.data;
  const returning = roundTrip ? ret.data : undefined;
  const flights = returning ? [outbound, returning] : [outbound];
  const back = new URLSearchParams({
    adults: String(adults),
    children: String(children),
    infants: String(infants),
    cabin: cabin!,
    });
    if (roundTrip) {
    back.set("return", returnId!);
    back.set("returnCabin", returnCabin!);
    }
  const backHref = `/flights/${flightId}?${back.toString()}`;

  const cabinOf = (f: FlightDetails, cls: string) => f.cabins.find((c) => c.cabinClass === cls);
  const weights = [cabinOf(outbound, cabin!)?.maxBagWeightKg, returning ? cabinOf(returning, returnCabin!)?.maxBagWeightKg : undefined].filter(
    (w): w is number => typeof w === "number",
  );
  const maxBagWeightKg = weights.length ? Math.min(...weights) : null;

  const notBookable = flights.find((f) => f.status !== "SCHEDULED");

  function buildBody(): BookingRequest {
    return {
      segments: [
        { flightId: flightId!, cabinClass: cabin! },
        ...(roundTrip ? [{ flightId: returnId!, cabinClass: returnCabin! }] : []),
      ],
      passengers: passengers.map((p) => {
        const bags = p.type === "INFANT" || p.extraBags === "" ? 0 : Number(p.extraBags);
        return {
          fullName: p.fullName.trim(),
          dateOfBirth: p.dateOfBirth,
          passportNumber: p.passportNumber.trim(),
          type: p.type,
          ...(bags > 0 ? { extraBags: bags, extraBagWeightKg: Number(p.extraBagWeightKg) } : {}),
        };
      }),
    };
  }

  async function review() {
    const errs = passengers.map((p) => validatePassenger(p, outbound.departureTimeUtc, maxBagWeightKg));
    setFieldErrors(errs);
    if (errs.some((e) => Object.keys(e).length > 0)) return;
    setBackendErrors([]);
    setBusy(true);
    try {
      setSummary(await api.post<Summary>("/flight-bookings", buildBody()));
    } catch (err) {
      setBackendErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  async function proceedToPayment() {
    setBackendErrors([]);
    setBusy(true);
    try {
        const res = await api.post<HoldResponse>("/flight-bookings/hold", buildBody());
        setHeldId(res.bookingId); // next step: seats, then payment
    } catch (err) {
        setBackendErrors(errorMessages(err));
    } finally {
        setBusy(false);
    }
  }

  function updatePassenger(i: number, next: PassengerForm) {
    setPassengers((list) => list.map((p, idx) => (idx === i ? next : p)));
  }

  return (
    <PageContainer size="md">
      <PageHeader
        title={summary ? "Review your booking" : "Passenger details"}
        description={
          summary
            ? "Seats are held for 10 minutes after you continue to payment."
            : `${passengers.length} passenger${passengers.length === 1 ? "" : "s"} · ${cabin}${roundTrip ? ` / ${returnCabin}` : ""}`
        }
        actions={<ButtonLink href={backHref} variant="outline">Back to flight</ButtonLink>}      />

      <div className="space-y-5">
        {notBookable && (
          <Alert tone="warning">Flight {notBookable.flightNumber} is {notBookable.status.toLowerCase()} and cannot be booked.</Alert>
        )}
        <FormErrors messages={backendErrors} />

        {summary ? (
          <>
            <BookingSummary summary={summary} flights={flights} />
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" disabled={busy} onClick={() => { setSummary(null); setBackendErrors([]); }}>
                Edit details
              </Button>
              <Button size="lg" loading={busy} disabled={Boolean(notBookable)} onClick={proceedToPayment}>
                Proceed to payment
              </Button>
            </div>
          </>
        ) : (
          <>
            {passengers.map((p, i) => (
              <PassengerFields
                key={i}
                index={i}
                value={p}
                errors={fieldErrors[i] ?? {}}
                maxBagWeightKg={maxBagWeightKg}
                onChange={(next) => updatePassenger(i, next)}
              />
            ))}
            <Card>
              <p className="text-sm text-slate-600">
                Ages are checked on the departure date of the outbound flight. Infants pay 10% of the fare and take no seat.
              </p>
            </Card>
            <div className="flex justify-end">
              <Button size="lg" loading={busy} disabled={Boolean(notBookable)} onClick={review}>
                Review summary
              </Button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const guest = !loading && !user;
  useEffect(() => {
    if (guest) router.replace(loginUrl(`/flights/book?${sp.toString()}`)); // ACC-10 keeps the query
  }, [guest, router, sp]);
  if (loading || guest) return <LoadingState />;
  return <>{children}</>;
}

function KeyedBook() {
  const sp = useSearchParams();
  // new query (flight, cabin, passenger counts) = fresh form state
  return <BookContent key={sp.toString()} />;
}

export default function FlightBookPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <GuestGuard>
        <RequireAuth roles={["user"]}>
          <KeyedBook />
        </RequireAuth>
      </GuestGuard>
    </Suspense>
  );
}