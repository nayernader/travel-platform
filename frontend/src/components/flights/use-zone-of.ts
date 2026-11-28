"use client";

import { useApi } from "@/lib/use-api";
import { airportCode, type Airport } from "@/lib/types-airlines";

/** GEN-06: airport code -> IANA time zone */
export function useZoneOf() {
  const airports = useApi<Airport[] | { items: Airport[] }>("/reference/airports");
  const list: Airport[] = Array.isArray(airports.data) ? airports.data : (airports.data?.items ?? []);
  return (code: string) => list.find((a) => airportCode(a) === code)?.timezone;
}