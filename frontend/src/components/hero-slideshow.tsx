"use client";

import { useEffect, useState } from "react";
import { MEDIA } from "@/lib/media";
import { BookingBar, type BookingMode } from "./booking-bar";
import { Photo } from "./photo";

const SLIDE_MS = 6500;
const GRADIENTS = [
  "from-stone-400 via-stone-600 to-night-900",
  "from-amber-200 via-stone-500 to-night-900",
  "from-orange-200 via-stone-500 to-night-800",
  "from-sky-200 via-stone-500 to-night-900",
  "from-emerald-200 via-stone-500 to-night-900",
];

const COPY: Record<BookingMode, { title: React.ReactNode; text: string }> = {
  stay: {
    title: <>Stays at their <em className="italic text-accent-100">very best.</em></>,
    text: "Hand-picked hotels in eight cities, with clear cancellation rules and rooms free for your exact dates.",
  },
  fly: {
    title: <>Every journey, <em className="italic text-accent-100">beautifully planned.</em></>,
    text: "Compare flights by price, duration and stops, choose your seats, and pay securely in one step.",
  },
};

/** Full-screen crossfading slideshow with numbered indicators, a Stay / Fly toggle and the booking bar. */
export function HeroSlideshow({ greeting }: { greeting?: string }) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<BookingMode>("stay");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % MEDIA.heroSlides.length), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [index]);

  return (
    <section className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden bg-night-900 text-white">
      {MEDIA.heroSlides.map((src, i) => (
        <div key={src} aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-[1600ms] ${i === index ? "opacity-100" : "opacity-0"}`}>
          <Photo src={src} alt="" priority={i === 0} gradient={GRADIENTS[i]}
            className={i === index ? "animate-[kenburns_14s_ease-out_forwards]" : ""} />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/40" />

      <div className="relative mx-auto w-full max-w-7xl px-6 pb-10 pt-36">
        <div className="mb-6 inline-flex rounded-full border border-white/40 p-1 text-[11px] font-semibold uppercase tracking-[0.25em]">
          {(["stay", "fly"] as BookingMode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={`rounded-full px-5 py-2 uppercase transition ${mode === m ? "bg-cream text-night-900" : "text-white/80 hover:text-white"}`}>
              {m}
            </button>
          ))}
        </div>

        <h1 className="max-w-4xl font-display text-5xl font-normal leading-[1.02] sm:text-7xl lg:text-[5.5rem]">
          {COPY[mode].title}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">{greeting ?? COPY[mode].text}</p>

        <div className="mt-10">
          <BookingBar mode={mode} />
        </div>

        <div className="mt-8 flex items-center gap-4">
          {MEDIA.heroSlides.map((src, i) => (
            <button key={src} type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`}
              className="group flex items-center gap-2 text-xs font-medium tabular-nums">
              <span className={i === index ? "text-white" : "text-white/50 group-hover:text-white/80"}>{String(i + 1).padStart(2, "0")}</span>
              <span className="relative hidden h-px w-12 overflow-hidden bg-white/30 sm:block">
                {i === index && (
                  <span key={index} className="absolute inset-0 origin-left bg-white"
                    style={{ animation: `progress ${SLIDE_MS}ms linear forwards` }} />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
