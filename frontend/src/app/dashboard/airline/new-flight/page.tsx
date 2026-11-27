"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormErrors } from "@/components/form-errors";
import { AirportSelect } from "@/components/reference/airport-select";
import { Button, Card, CardTitle, Input, PageHeader } from "@/components/ui";
import { api, errorMessages } from "@/lib/api";
import { CABIN_CLASSES } from "@/lib/types-airlines";

interface CabinRow {
  cabinClass: string;
  enabled: boolean;
  totalSeats: string;
  price: string;
  freeBags: string;
  maxBagWeightKg: string;
}

const emptyCabins = (): CabinRow[] =>
  CABIN_CLASSES.map((c) => ({
    cabinClass: c,
    enabled: c === "Economy",
    totalSeats: "",
    price: "",
    freeBags: "1",
    maxBagWeightKg: "23",
  }));

export default function NewFlightPage() {
  const router = useRouter();
  const [flightNumber, setFlightNumber] = useState("");
  const [dep, setDep] = useState("");
  const [arr, setArr] = useState("");
  const [depLocal, setDepLocal] = useState("");
  const [arrLocal, setArrLocal] = useState("");
  const [cabins, setCabins] = useState<CabinRow[]>(emptyCabins());
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function updateCabin(i: number, patch: Partial<CabinRow>) {
    setCabins(cabins.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    const local: string[] = [];
    if (!dep) local.push("Choose a departure airport.");
    if (!arr) local.push("Choose an arrival airport.");
    if (dep && dep === arr) local.push("Departure and arrival airports must differ.");
    if (!cabins.some((c) => c.enabled)) local.push("Add at least one cabin category.");
    if (local.length) {
      setErrors(local);
      return;
    }

    setBusy(true);
    let flightId = "";
    try {
      // FLT-03: times are LOCAL at each airport; the backend stores UTC.
      const res = (await api.post("/flights", {
        flightNumber,
        departureAirport: dep,
        arrivalAirport: arr,
        departureLocal: depLocal,
        arrivalLocal: arrLocal,
      })) as { _id?: string; data?: { _id?: string } };
      flightId = res?._id ?? res?.data?._id ?? "";
      if (!flightId) throw new Error("The flight was created but no id was returned.");

      // FLT-04: one request per enabled cabin
      for (const c of cabins.filter((x) => x.enabled)) {
        await api.post(`/flights/${flightId}/cabins`, {
          cabinClass: c.cabinClass,
          totalSeats: Number(c.totalSeats),
          price: Number(c.price),
          freeBags: Number(c.freeBags),
          maxBagWeightKg: Number(c.maxBagWeightKg),
        });
      }
      router.push(`/dashboard/airline/flights/${flightId}`);
    } catch (err) {
      const msgs = errorMessages(err);
      setErrors(
        flightId
          ? [...msgs, "The flight was created, but a cabin failed. Open the flight to fix its cabins."]
          : msgs,
      );
      if (flightId) setTimeout(() => router.push(`/dashboard/airline/flights/${flightId}`), 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New flight" description="Times are entered in each airport's local time" />
      <form onSubmit={submit} className="space-y-6">
        <FormErrors messages={errors} />
        <Card>
          <CardTitle>Flight</CardTitle>
          <div className="mt-4 space-y-4">
            <Input
              label="Flight number (e.g. MS777)"
              required
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
            />
            <AirportSelect label="Departure airport" value={dep} onChange={(c) => setDep(c)} excludeCode={arr} />
            <AirportSelect label="Arrival airport" value={arr} onChange={(c) => setArr(c)} excludeCode={dep} />
            <Input
              label="Departure (local time at departure airport)"
              type="datetime-local"
              required
              value={depLocal}
              onChange={(e) => setDepLocal(e.target.value)}
            />
            <Input
              label="Arrival (local time at arrival airport)"
              type="datetime-local"
              required
              value={arrLocal}
              onChange={(e) => setArrLocal(e.target.value)}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Cabins</CardTitle>
          <div className="mt-4 space-y-6">
            {cabins.map((c, i) => (
              <div key={c.cabinClass} className="space-y-3 rounded-lg border p-4">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={c.enabled}
                    onChange={(e) => updateCabin(i, { enabled: e.target.checked })}
                  />
                  {c.cabinClass}
                </label>
                {c.enabled && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Seats"
                      type="number"
                      min={1}
                      step="1"
                      required
                      value={c.totalSeats}
                      onChange={(e) => updateCabin(i, { totalSeats: e.target.value })}
                    />
                    <Input
                      label="Price"
                      type="number"
                      min={0.01}
                      step="0.01"
                      required
                      value={c.price}
                      onChange={(e) => updateCabin(i, { price: e.target.value })}
                    />
                    <Input
                      label="Free bags"
                      type="number"
                      min={0}
                      step="1"
                      required
                      value={c.freeBags}
                      onChange={(e) => updateCabin(i, { freeBags: e.target.value })}
                    />
                    <Input
                      label="Max weight per bag (kg)"
                      type="number"
                      min={0.1}
                      step="0.1"
                      required
                      value={c.maxBagWeightKg}
                      onChange={(e) => updateCabin(i, { maxBagWeightKg: e.target.value })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Button type="submit" loading={busy}>
          Create flight
        </Button>
      </form>
    </>
  );
}