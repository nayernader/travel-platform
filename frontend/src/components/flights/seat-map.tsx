"use client";

import { useMemo } from "react";
import type { SeatMapSeat } from "@/lib/types-flights";

interface SeatMapProps {
  seats: SeatMapSeat[];
  /** seatNumber -> passenger index (0-based) chosen on this screen */
  selected: Record<string, number>;
  /** Seats this booking already holds: the map reports them as TAKEN, but they stay selectable */
  own?: string[];
  onPick: (seatNumber: string) => void;
  disabled?: boolean;
}

/** FLT-28: rows of seats with an aisle in the middle. Letters come from the seat labels (4 or 6 per row). */
export function SeatMap({ seats, selected, own = [], onPick, disabled }: SeatMapProps) {
  const { rows, letters } = useMemo(() => {
    const byRow = new Map<number, Map<string, SeatMapSeat>>();
    const set = new Set<string>();
    for (const s of seats) {
      const m = /^(\d+)([A-Z])$/.exec(s.seatNumber);
      if (!m) continue;
      set.add(m[2]);
      const row = byRow.get(Number(m[1])) ?? new Map<string, SeatMapSeat>();
      row.set(m[2], s);
      byRow.set(Number(m[1]), row);
    }
    return {
      letters: [...set].sort(),
      rows: [...byRow.entries()].sort((a, b) => a[0] - b[0]),
    };
  }, [seats]);

  const aisleAfter = Math.floor(letters.length / 2) - 1;
  const mine = new Set(own);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <Legend className="border-brand-300 bg-white" label="Available" />
        <Legend className="border-brand-600 bg-brand-600" label="Selected" />
        <Legend className="border-accent-400 bg-accent-100" label="Your current seat" />
        <Legend className="border-sand bg-sand" label="Taken" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-sand bg-cream p-3">
        <div className="mx-auto w-fit space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-6" />
            {letters.map((l, i) => (
              <span key={l} className={`w-9 text-center ${i === aisleAfter ? "mr-5" : ""}`}>{l}</span>
            ))}
          </div>
          {rows.map(([n, cells]) => (
            <div key={n} className="flex items-center gap-1.5">
              <span className="w-6 text-right text-xs text-slate-500">{n}</span>
              {letters.map((l, i) => {
                const seat = cells.get(l);
                const gap = i === aisleAfter ? "mr-5" : "";
                if (!seat) return <span key={l} className={`h-9 w-9 ${gap}`} />;
                const pick = selected[seat.seatNumber];
                const isMine = mine.has(seat.seatNumber);
                const taken = seat.status === "TAKEN" && !isMine;
                const tone =
                  pick !== undefined
                    ? "border-brand-600 bg-brand-600 text-white"
                    : isMine
                      ? "border-accent-400 bg-accent-100 text-accent-700"
                      : taken
                        ? "cursor-not-allowed border-sand bg-sand text-slate-400"
                        : "border-brand-300 bg-white text-brand-700 hover:bg-brand-50";
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={disabled || taken}
                    aria-label={`Seat ${seat.seatNumber}${taken ? ", taken" : ""}`}
                    onClick={() => onPick(seat.seatNumber)}
                    className={`h-9 w-9 rounded-md border text-xs font-medium transition ${tone} ${gap}`}
                  >
                    {pick !== undefined ? `P${pick + 1}` : l}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-4 w-4 rounded border ${className}`} />
      {label}
    </span>
  );
}