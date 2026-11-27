"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmAction } from "@/components/airlines/confirm-action";
import { FormErrors } from "@/components/form-errors";
import { Alert, Button, Card, CardTitle, Input, LoadingState, PageHeader } from "@/components/ui";
import { api, errorMessages } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Cabin, Flight } from "@/lib/types-airlines";

export default function FlightPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FlightLoader />
    </Suspense>
  );
}

function FlightLoader() {
  const params = useParams<{ id: string }>();
  const id = String(params.id);
  const { data, errors, loading, reload } = useApi<Flight>(`/flights/${id}`);
  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;
  if (!data) return null;
  return <FlightEditor key={data._id + data.status} flight={data} reload={reload} />;
}

function FlightEditor({ flight, reload }: { flight: Flight; reload: () => void }) {
  const router = useRouter();
  const editable = flight.status === "SCHEDULED";
  const [depLocal, setDepLocal] = useState(flight.departureLocal ?? "");
  const [arrLocal, setArrLocal] = useState(flight.arrivalLocal ?? "");
  const [timeErrors, setTimeErrors] = useState<string[]>([]);
  const [timeSaved, setTimeSaved] = useState(false);
  const [timeBusy, setTimeBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErrors, setCancelErrors] = useState<string[]>([]);

  // Check: body names must match PATCH /api/flights/{id} in Swagger.
  async function saveTimes(e: React.FormEvent) {
    e.preventDefault();
    setTimeErrors([]);
    setTimeSaved(false);
    setTimeBusy(true);
    try {
      await api.patch(`/flights/${flight._id}`, { departureLocal: depLocal, arrivalLocal: arrLocal });
      setTimeSaved(true);
      reload();
    } catch (err) {
      setTimeErrors(errorMessages(err));
    } finally {
      setTimeBusy(false);
    }
  }

  async function cancelFlight() {
    setCancelErrors([]);
    setCancelBusy(true);
    try {
      await api.post(`/flights/${flight._id}/cancel`, {});
      setConfirmOpen(false);
      router.push("/dashboard/airline");
    } catch (err) {
      setConfirmOpen(false);
      setCancelErrors(errorMessages(err));
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={`Flight ${flight.flightNumber}`}
        description={`${flight.departureAirport} to ${flight.arrivalAirport}, status: ${flight.status}`}
      />
      {!editable && <Alert tone="info">Only Scheduled flights can be edited or cancelled.</Alert>}

      <div className="space-y-6">
        <Card>
          <CardTitle>Times (local at each airport)</CardTitle>
          <p className="mt-2 text-sm">
            Airports ({flight.departureAirport} to {flight.arrivalAirport}) cannot be changed here.
          </p>
          <form onSubmit={saveTimes} className="mt-4 space-y-4">
            <FormErrors messages={timeErrors} />
            {timeSaved && <Alert tone="success">Times saved. Passengers with confirmed bookings are notified.</Alert>}
            <Input
              label={`Departure (local at ${flight.departureAirport})`}
              type="datetime-local"
              required
              disabled={!editable}
              value={depLocal}
              onChange={(e) => setDepLocal(e.target.value)}
            />
            <Input
              label={`Arrival (local at ${flight.arrivalAirport})`}
              type="datetime-local"
              required
              disabled={!editable}
              value={arrLocal}
              onChange={(e) => setArrLocal(e.target.value)}
            />
            {editable && (
              <Button type="submit" loading={timeBusy}>
                Save times
              </Button>
            )}
          </form>
        </Card>

        {flight.cabins.map((c) => (
          <CabinEditor key={c._id} flightId={flight._id} cabin={c} editable={editable} reload={reload} />
        ))}
        {flight.cabins.length === 0 && <p className="text-sm">This flight has no cabins yet.</p>}

        <p className="text-sm underline">
          <Link href={`/dashboard/airline/flights/${flight._id}/bookings`}>View bookings and export CSV</Link>
        </p>

        {editable && (
          <Card>
            <CardTitle>Cancel flight</CardTitle>
            <div className="mt-4 space-y-4">
              <FormErrors messages={cancelErrors} />
              <Button type="button" variant="danger" onClick={() => setConfirmOpen(true)}>
                Cancel this flight
              </Button>
            </div>
          </Card>
        )}
      </div>

      <ConfirmAction
        open={confirmOpen}
        title="Cancel this flight?"
        message="All confirmed bookings will be cancelled with a 100% refund and pending holds are released. This cannot be undone."
        confirmLabel="Cancel flight"
        loading={cancelBusy}
        onConfirm={cancelFlight}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function CabinEditor({
  flightId,
  cabin,
  editable,
  reload,
}: {
  flightId: string;
  cabin: Cabin;
  editable: boolean;
  reload: () => void;
}) {
  const [price, setPrice] = useState(String(cabin.price));
  const [seats, setSeats] = useState(String(cabin.totalSeats));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Check: body names must match PATCH /api/flights/{id}/cabins/{cabinId} in Swagger.
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.patch(`/flights/${flightId}/cabins/${cabin._id}`, {
        price: Number(price),
        totalSeats: Number(seats),
      });
      setSaved(true);
      reload();
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>{cabin.cabinClass}</CardTitle>
      <p className="mt-2 text-sm">
        Seats remaining: {cabin.availableSeats} of {cabin.totalSeats}. Price changes do not affect existing bookings.
      </p>
      <form onSubmit={save} className="mt-4 space-y-4">
        <FormErrors messages={errors} />
        {saved && <Alert tone="success">Cabin saved.</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Price"
            type="number"
            min={0.01}
            step="0.01"
            required
            disabled={!editable}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            label="Seats"
            type="number"
            min={1}
            step="1"
            required
            disabled={!editable}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
        </div>
        {editable && (
          <Button type="submit" loading={busy}>
            Save cabin
          </Button>
        )}
      </form>
    </Card>
  );
}