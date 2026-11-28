"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { AirportSelect } from "@/components/reference/airport-select";
import { CABINS, type FlightQuery } from "@/lib/types-flights";

/** FLT-11, FLT-12, FLT-15 search form. Validates for comfort only (GEN-13). */
export function FlightSearchForm({
  initial,
  onSearch,
}: {
  initial: FlightQuery;
  onSearch: (q: FlightQuery) => void;
}) {
  const [q, setQ] = useState(initial);
  const [roundTrip, setRoundTrip] = useState(!!initial.returnDate);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = <K extends keyof FlightQuery>(k: K, v: FlightQuery[K]) => setQ((x) => ({ ...x, [k]: v }));
  const num = (v: string) => Math.max(0, Number(v) || 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!q.from) x.from = "Choose a departure airport.";
    if (!q.to) x.to = "Choose an arrival airport.";
    if (q.from && q.from === q.to) x.to = "Departure and arrival airports must differ.";
    if (!q.date) x.date = "Choose a departure date.";
    if (roundTrip && !q.returnDate) x.returnDate = "Choose a return date.";
    if (roundTrip && q.returnDate && q.returnDate < q.date) x.returnDate = "Return cannot be before departure.";
    if (q.adults < 1) x.adults = "At least one adult is required.";
    if (q.infants > q.adults) x.infants = "No more infants than adults.";
    if (q.adults + q.children > 9) x.adults = "At most 9 seats per search.";
    if (q.min && q.max && Number(q.min) > Number(q.max)) x.max = "Minimum price cannot be greater than maximum price.";
    setErr(x);
    if (Object.keys(x).length) return;
    onSearch({ ...q, returnDate: roundTrip ? q.returnDate : "", page: 1 });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        <Button type="button" variant={roundTrip ? "ghost" : undefined} onClick={() => setRoundTrip(false)}>
          One way
        </Button>
        <Button type="button" variant={roundTrip ? undefined : "ghost"} onClick={() => setRoundTrip(true)}>
          Round trip
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AirportSelect label="From" value={q.from} error={err.from} excludeCode={q.to}
          onChange={(c) => set("from", c)} />
        <AirportSelect label="To" value={q.to} error={err.to} excludeCode={q.from}
          onChange={(c) => set("to", c)} />
        <Input label="Departure date" type="date" value={q.date} error={err.date}
          onChange={(e) => set("date", e.target.value)} />
        {roundTrip && (
          <Input label="Return date" type="date" value={q.returnDate} error={err.returnDate}
            onChange={(e) => set("returnDate", e.target.value)} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Input label="Adults (12+)" type="number" min={1} value={q.adults} error={err.adults}
          onChange={(e) => set("adults", num(e.target.value))} />
        <Input label="Children (2-11)" type="number" min={0} value={q.children}
          onChange={(e) => set("children", num(e.target.value))} />
        <Input label="Infants (under 2)" type="number" min={0} value={q.infants} error={err.infants}
          onChange={(e) => set("infants", num(e.target.value))} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Cabin" value={q.cabin} onChange={(e) => set("cabin", e.target.value)}>
          <option value="">Any cabin</option>
          {CABINS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Input label="Min price" type="number" min={0} value={q.min}
          onChange={(e) => set("min", e.target.value)} />
        <Input label="Max price" type="number" min={0} value={q.max} error={err.max}
          onChange={(e) => set("max", e.target.value)} />
      </div>

      <Button type="submit">Search flights</Button>
    </form>
  );
}