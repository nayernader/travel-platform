"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormErrors } from "@/components/form-errors";
import { FlightRow } from "@/components/flights/flight-row";
import { FlightSearchForm } from "@/components/flights/flight-search-form";
import { Button, Card, EmptyState, LoadingState, PageContainer, PageHeader, Pagination, Select } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import {
  isRoundTrip, parseQuery, toApiParams, toSearchString,
  type FlightList, type FlightSearchResponse,
} from "@/lib/types-flights";

function FlightsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const q = parseQuery(params);
  const [outId, setOutId] = useState("");
  const [retId, setRetId] = useState("");

  const ready = !!(q.from && q.to && q.date);
  const roundTrip = !!q.returnDate;
  const priceError = q.min && q.max && Number(q.min) > Number(q.max)
    ? "Minimum price cannot be greater than maximum price." : "";

  // FLT-15: no request when min > max
  const { data, errors, loading } = useApi<FlightSearchResponse>(
    ready && !priceError ? "/flights/search" : null,
    ready ? toApiParams(q) : {},
  );

  const go = (next: Partial<typeof q>) => router.push(`/flights?${toSearchString({ ...q, ...next })}`);

  const carry = toSearchString({ ...q, page: 1, sort: "price", min: "", max: "", from: "", to: "", date: "", returnDate: "" });
  const detailsHref = (id: string, ret?: string) =>
    `/flights/${id}?${carry}${ret ? `&return=${ret}` : ""}`;

  const round = data && isRoundTrip(data) ? data : null;
  const oneWay: FlightList | null = data && !isRoundTrip(data) ? data : null;
  const pager = round ? round.outbound : oneWay;

  function column(title: string, list: FlightList, sel: string, pick: (id: string) => void) {
    return (
      <div className="space-y-3">
        <h2 className="font-display text-xl">{title}</h2>
        {!list.items.length && <EmptyState title="No flights found" description="Try another date or airport." />}
        {list.items.map((f) => (
          <FlightRow key={f._id} f={f} action={
            <Button type="button" variant={sel === f._id ? undefined : "ghost"} onClick={() => pick(f._id)}>
              {sel === f._id ? "Selected" : "Select"}
            </Button>} />
        ))}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Flights"
        description={ready ? `${q.from} to ${q.to} on ${q.date}${roundTrip ? `, back ${q.returnDate}` : ""}` : "Search flights"}
        actions={
          <Select label="Sort by" value={q.sort} onChange={(e) => go({ sort: e.target.value as typeof q.sort, page: 1 })}>
            <option value="price">Price</option>
            <option value="duration">Duration</option>
            <option value="departureTime">Departure time</option>
          </Select>
        }
      />

      <Card className="mb-6">
        <FlightSearchForm key={params.toString()} initial={q} onSearch={(next) => go(next)} />
      </Card>

      {!ready && <EmptyState title="Where to?" description="Choose airports and a date to see flights." />}
      {priceError && <FormErrors messages={[priceError]} />}
      {loading && <LoadingState label="Searching flights..." />}
      {errors && <FormErrors messages={errors} />}

      {oneWay && (
        <div className="space-y-3">
          {!oneWay.items.length && <EmptyState title="No flights found" description="Try another date, airport or price range." />}
          {oneWay.items.map((f) => (
            <FlightRow key={f._id} f={f} action={<Link href={detailsHref(f._id)}><Button type="button">View</Button></Link>} />
          ))}
        </div>
      )}

      {round && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {column("Outbound", round.outbound, outId, setOutId)}
            {column("Return", round.return, retId, setRetId)}
          </div>
          {outId && retId && (
            <div className="mt-4">
              <Link href={detailsHref(outId, retId)}><Button type="button">Continue with both flights</Button></Link>
            </div>
          )}
        </>
      )}

      {pager && <Pagination page={pager.page} total={pager.total} onPageChange={(p) => go({ page: p })} />}
    </PageContainer>
  );
}

export default function FlightsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FlightsContent />
    </Suspense>
  );
}