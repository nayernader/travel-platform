"use client";

import Link from "next/link";
import { useRef } from "react";
import { DESTINATIONS } from "@/lib/destinations";
import { MEDIA } from "@/lib/media";
import { Photo } from "./photo";

/** Editorial slider of our cities: photo, serif name and a quiet link. Swipe or use the arrows. */
export function DestinationCarousel() {
  const track = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? 320) + 32), behavior: "smooth" });
  }

  const arrow = "grid h-12 w-12 place-items-center rounded-full border border-night-900/25 text-night-900 transition hover:bg-night-900 hover:text-cream";

  return (
    <div>
      <div className="mb-10 flex items-end justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent-600">Our cities</p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">Eight places, <em className="italic">endless stays</em></h2>
        </div>
        <div className="hidden gap-3 sm:flex">
          <button type="button" aria-label="Previous" className={arrow} onClick={() => scroll(-1)}>←</button>
          <button type="button" aria-label="Next" className={arrow} onClick={() => scroll(1)}>→</button>
        </div>
      </div>

      <div ref={track} className="-mx-6 flex snap-x snap-mandatory gap-8 overflow-x-auto px-6 pb-4 [scrollbar-width:none]">
        {DESTINATIONS.map((d) => (
          <Link key={d.cityId} href={`/hotels?city=${d.cityId}`} data-card className="group w-[78vw] shrink-0 snap-start sm:w-[360px]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
              <Photo src={MEDIA.city(d.cityId)} alt={d.city} gradient={d.gradient}
                className="transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
              <span className="absolute left-4 top-4 rounded-full bg-cream/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-night-900">
                {d.airport}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">{d.country}</p>
            <h3 className="mt-1 font-display text-3xl">{d.city}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{d.tagline}</p>
            <span className="mt-4 inline-flex items-center gap-2 border-b border-night-900/30 pb-1 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all group-hover:gap-4 group-hover:border-night-900">
              View hotels <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
