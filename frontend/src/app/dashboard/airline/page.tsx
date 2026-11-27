"use client";

import Link from "next/link";
import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { Button, Card, EmptyState, LoadingState, PageHeader } from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { useApi } from "@/lib/use-api";
import { formatInZone, airportCode, type Airport, type Flight, type PageOf } from "@/lib/types-airlines";

export default function AirlineFlightsPage() {
  const { user } = useAuth();
  const airlineId = user?.providerId;
  if (!airlineId) {
    return (
      <EmptyState
        title="No airline assigned"
        description="Ask an administrator to link your account to an airline."
      />
    );
  }
  return <FlightsList airlineId={String(airlineId)} />;
}

const STATUS_LABEL: Record<Flight["status"], string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  DEPARTED: "Departed",
};

function FlightsList({ airlineId }: { airlineId: string }) {
  const [page, setPage] = useState(1);
  const { data, errors, loading } = useApi<PageOf<Flight>>(`/airlines/${airlineId}/flights`, { page });
  const airports = useApi<Airport[] | { items: Airport[] }>("/reference/airports");

  const list: Airport[] = Array.isArray(airports.data) ? airports.data : (airports.data?.items ?? []);
  const zoneOf = (code: string) => list.find((a) => airportCode(a) === code)?.timezone;

  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;

  return (
    <>
      <PageHeader title="Your flights" description="Times shown in each airport's local time" />
      {!data?.items.length ? (
        <EmptyState
          title="No flights yet"
          description="Create your first flight to start selling seats."
          action={
            <Link href="/dashboard/airline/new-flight" className="underline">
              New flight
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {data.items.map((f) => (
            <Card key={f._id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {f.flightNumber}: {f.departureAirport} to {f.arrivalAirport}
                  </p>
                  <p className="text-sm">
                    {formatInZone(f.departureTimeUtc, zoneOf(f.departureAirport))} (local at{" "}
                    {f.departureAirport})
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-sm">{STATUS_LABEL[f.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm underline">
                <Link href={`/dashboard/airline/flights/${f._id}/bookings`}>Bookings</Link>
                {f.status === "SCHEDULED" && (
                  <Link href={`/dashboard/airline/flights/${f._id}`}>Edit or cancel</Link>
                )}
              </div>
            </Card>
          ))}
          <div className="flex items-center justify-between">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm">
              Page {data.page} of {data.pages}
            </span>
            <Button variant="outline" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

