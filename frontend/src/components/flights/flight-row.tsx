import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { formatDuration, formatLocalTime, formatMoney } from "@/lib/format";
import type { FlightResult as F } from "@/lib/types-flights";

export function FlightRow({ f, action }: { f: F; action: ReactNode }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {f.airlineName ? `${f.airlineName} · ` : ""}{f.flightNumber}
          </p>
          {/* GEN-06: each time in its own airport's time zone */}
          <p className="text-sm text-slate-600">
            {formatLocalTime(f.departureTimeUtc, f.departureTimeZone)} {f.departureAirport} to{" "}
            {formatLocalTime(f.arrivalTimeUtc, f.arrivalTimeZone)} {f.arrivalAirport}
            {" · "}{formatDuration(f.durationMinutes)}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-lg font-semibold text-brand-700">from {formatMoney(f.fromPrice)}</p>
          {action}
        </div>
      </div>
    </Card>
  );
}