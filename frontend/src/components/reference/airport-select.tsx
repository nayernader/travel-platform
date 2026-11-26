"use client";

import { useMemo, useState } from "react";
import { Button, EmptyState, Input, LoadingState } from "@/components/ui";
import { FormErrors } from "@/components/form-errors";
import { useApi } from "@/lib/use-api";
import { airportCode, airportLabel, type Airport } from "@/lib/types-airlines";

interface AirportSelectProps {
  label?: string;
  /** The selected IATA code, or "" when nothing is selected. */
  value: string;
  onChange: (code: string, airport: Airport | null) => void;
  error?: string;
  required?: boolean;
  /** Hide one airport, e.g. the departure airport in the arrival picker. */
  excludeCode?: string;
}

/**
 * FLT-02: searchable airport picker (IATA code, city, airport name).
 * Data comes from GET /api/reference/airports. Used by Members 2, 3 and 7.
 */
export function AirportSelect({
  label = "Airport",
  value,
  onChange,
  error,
  required,
  excludeCode,
}: AirportSelectProps) {
  const { data, errors, loading } = useApi<Airport[] | { items: Airport[] }>(
    "/reference/airports",
  );
  const [query, setQuery] = useState("");

  const airports: Airport[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : (data.items ?? []);
  }, [data]);

  const selected = airports.find((a) => airportCode(a) === value.toUpperCase());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports
      .filter((a) => airportCode(a) !== (excludeCode ?? "").toUpperCase())
      .filter((a) => !q || airportLabel(a).toLowerCase().includes(q));
  }, [airports, query, excludeCode]);

  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;

  // A code is chosen: show it with a Change button.
  if (value) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span>{selected ? airportLabel(selected) : value.toUpperCase()}</span>
          <Button type="button" variant="ghost" onClick={() => onChange("", null)}>
            Change
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Nothing chosen yet: search box and result list.
  return (
    <div className="space-y-2">
      <Input
        label={label}
        placeholder="Search by code, city or airport name"
        required={required}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        error={error}
      />
      <div className="max-h-60 overflow-auto rounded-lg border">
        {filtered.length === 0 ? (
          <EmptyState
            title="No airports found"
            description="Try a different code, city or name."
          />
        ) : (
          filtered.map((a) => (
            <button
              key={airportCode(a)}
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-black/5"
              onClick={() => {
                setQuery("");
                onChange(airportCode(a), a);
              }}
            >
              {airportLabel(a)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}