"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { FormErrors } from "@/components/form-errors";
import { Card, CardTitle, EmptyState, LoadingState, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import type { Flight } from "@/lib/types-airlines";

type Row = Record<string, unknown>;

function text(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return JSON.stringify(v);
}

/** Check: field names below must match GET /api/flights/{id}/bookings in Swagger. */
function passengerNames(b: Row): string {
  const list = b.passengers;
  if (!Array.isArray(list)) return "-";
  return list
    .map((p) => (p && typeof p === "object" ? text((p as Row).fullName ?? (p as Row).name) : text(p)))
    .join(", ");
}

export default function FlightBookingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BookingsLoader />
    </Suspense>
  );
}

function BookingsLoader() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const flight = useApi<Flight>(`/flights/${id}`);
  const bookings = useApi<Row[] | { items: Row[] }>(`/flights/${id}/bookings`);

  if (flight.loading || bookings.loading) return <LoadingState />;
  if (bookings.errors) return <FormErrors messages={bookings.errors} />;

  const rows: Row[] = Array.isArray(bookings.data) ? bookings.data : (bookings.data?.items ?? []);

  return (
    <>
      <PageHeader
        title={`Bookings for ${flight.data?.flightNumber ?? "flight"}`}
        description="Reference, passengers, cabin, seats and status"
      />
      <div className="space-y-6">
        <Card>
          <CardTitle>Seats remaining</CardTitle>
          {flight.data?.cabins.length ? (
            <ul className="mt-3 space-y-1 text-sm">
              {flight.data.cabins.map((c) => (
                <li key={c._id}>
                  {c.cabinClass}: {c.availableSeats} of {c.totalSeats} seats remaining
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">No cabins on this flight.</p>
          )}
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard/airline" className="text-sm underline">
            Back to flights
          </Link>
          <a href={`/api/flights/${id}/passengers/export`} download className="rounded-lg border px-4 py-2 text-sm">
            Export CSV
          </a>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No bookings yet" description="Bookings will appear here once passengers book this flight." />
        ) : (
          <div className="space-y-4">
            {rows.map((b, i) => (
              <Card key={text(b._id ?? i)}>
                <p className="font-semibold">{text(b.reference ?? b.bookingReference)}</p>
                <p className="text-sm">Passengers: {passengerNames(b)}</p>
                <p className="text-sm">Cabin: {text(b.cabinClass ?? b.cabin)}</p>
                <p className="text-sm">Seats: {text(b.seats ?? b.seatCount)}</p>
                <p className="text-sm">Status: {text(b.status)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}