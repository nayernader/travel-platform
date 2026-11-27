"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { Input, LoadingState } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { airportCode, airportLabel, type Airport } from "@/lib/types-airlines";

/** Same props as AirportSelect, but the list only opens when the field is clicked or focused. */
export function AirportCombobox({
  label = "Airport",
  value,
  onChange,
  error,
  excludeCode,
}: {
  label?: string;
  value: string;
  onChange: (code: string, airport: Airport | null) => void;
  error?: string;
  excludeCode?: string;
}) {
  const { data, errors, loading } = useApi<Airport[] | { items: Airport[] }>("/reference/airports");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const airports: Airport[] = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : (data.items ?? []);
  }, [data]);

  const selected = airports.find((a) => airportCode(a) === value.toUpperCase());
  const selectedText = value ? (selected ? airportLabel(selected) : value.toUpperCase()) : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return airports
      .filter((a) => airportCode(a) !== (excludeCode ?? "").toUpperCase())
      .filter((a) => !q || airportLabel(a).toLowerCase().includes(q));
  }, [airports, query, excludeCode]);

  // close when clicking outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;

  return (
    <div ref={box} className="relative">
      <Input
        label={label}
        placeholder="Search by code, city or airport name"
        autoComplete="off"
        value={open ? query : selectedText}
        error={error}
        onFocus={() => { setQuery(""); setOpen(true); }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-sand bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-600">No airports found. Try a different code, city or name.</p>
          ) : (
            filtered.map((a) => (
              <button
                key={airportCode(a)}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5"
                onClick={() => {
                  onChange(airportCode(a), a);
                  setOpen(false);
                }}
              >
                {airportLabel(a)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}