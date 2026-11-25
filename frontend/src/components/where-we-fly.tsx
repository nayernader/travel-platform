"use client";

import Link from "next/link";
import { useState } from "react";
import { DESTINATIONS } from "@/lib/destinations";
import { Globe } from "./globe";

/** Interactive map section: pick a city and the globe turns to it. */
export function WhereWeFly() {
  const [active, setActive] = useState(DESTINATIONS[0].cityId);
  const current = DESTINATIONS.find((d) => d.cityId === active) ?? DESTINATIONS[0];

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent-300">Where we fly</p>
        <h2 className="mt-4 font-display text-4xl text-white sm:text-6xl">Eight cities, <em className="italic text-accent-300">one journey</em></h2>
        <p className="mt-5 max-w-md text-stone-300">Choose a city to turn the globe. Every destination connects to flights, hotels and shared itineraries.</p>

        <ul className="mt-8 grid grid-cols-2 gap-2">
          {DESTINATIONS.map((d) => (
            <li key={d.cityId}>
              <button type="button" onClick={() => setActive(d.cityId)} onMouseEnter={() => setActive(d.cityId)}
                aria-pressed={active === d.cityId}
                className={`flex w-full items-center justify-between rounded-sm border px-4 py-3 text-left text-sm transition ${
                  active === d.cityId
                    ? "border-accent-300 bg-accent-300/10 text-white"
                    : "border-white/10 text-stone-300 hover:border-white/30 hover:text-white"
                }`}>
                <span className="font-display text-lg">{d.city}</span>
                <span className="font-mono text-xs text-stone-400">{d.airport}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href={`/flights?from=CAI&to=${current.airport}`} className="rounded-full bg-cream px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-night-900 transition hover:bg-accent-100">
            Flights to {current.city}
          </Link>
          <Link href={`/hotels?city=${current.cityId}`} className="rounded-full border border-white/30 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white">
            Hotels in {current.city}
          </Link>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[540px]">
        <div aria-hidden className="absolute inset-10 rounded-full bg-accent-500/20 blur-3xl" />
        <Globe focus={current.location} />
      </div>
    </div>
  );
}
