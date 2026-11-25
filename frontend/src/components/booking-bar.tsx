"use client";

import { useRouter } from "next/navigation";
import { DESTINATIONS } from "@/lib/destinations";

export type BookingMode = "stay" | "fly";

const cell = "flex flex-col gap-1 border-stone-200 px-5 py-3 text-left md:border-r";
const lab = "text-[10px] font-semibold uppercase tracking-[0.22em] text-stone-500";
const input = "w-full bg-transparent font-display text-xl text-night-900 focus:outline-none [color-scheme:light]";

/**
 * Hotel-style booking bar. It only builds the URL; the results pages read it:
 *   /hotels?city=cairo&checkIn=2026-12-20&checkOut=2026-12-23&guests=2&rooms=1   (Member 5)
 *   /flights?from=CAI&to=DXB&date=2026-12-20&passengers=1                        (Member 3)
 */
export function BookingBar({ mode }: { mode: BookingMode }) {
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    data.forEach((v, k) => {
      if (typeof v === "string" && v) params.set(k, v);
    });
    router.push(`/${mode === "stay" ? "hotels" : "flights"}?${params.toString()}`);
  }

  return (
    <form key={mode} onSubmit={onSubmit}
      className="grid overflow-hidden rounded-sm bg-cream shadow-2xl shadow-black/30 md:grid-cols-[1.3fr_1fr_1fr_0.8fr_auto]">
      {mode === "stay" ? (
        <>
          <label className={cell}>
            <span className={lab}>Destination</span>
            <select name="city" defaultValue="dubai" className={input}>
              {DESTINATIONS.map((d) => <option key={d.cityId} value={d.cityId}>{d.city}</option>)}
            </select>
          </label>
          <label className={cell}>
            <span className={lab}>Arrival</span>
            <input name="checkIn" type="date" required className={input} />
          </label>
          <label className={cell}>
            <span className={lab}>Departure</span>
            <input name="checkOut" type="date" required className={input} />
          </label>
          <label className={cell}>
            <span className={lab}>Guests</span>
            <input name="guests" type="number" min={1} max={20} defaultValue={2} className={input} />
          </label>
        </>
      ) : (
        <>
          <label className={cell}>
            <span className={lab}>From</span>
            <select name="from" defaultValue="CAI" className={input}>
              {DESTINATIONS.map((d) => <option key={d.airport} value={d.airport}>{d.city}</option>)}
            </select>
          </label>
          <label className={cell}>
            <span className={lab}>To</span>
            <select name="to" defaultValue="DXB" className={input}>
              {DESTINATIONS.map((d) => <option key={d.airport} value={d.airport}>{d.city}</option>)}
            </select>
          </label>
          <label className={cell}>
            <span className={lab}>Departure</span>
            <input name="date" type="date" required className={input} />
          </label>
          <label className={cell}>
            <span className={lab}>Passengers</span>
            <input name="passengers" type="number" min={1} max={9} defaultValue={1} className={input} />
          </label>
        </>
      )}
      <button type="submit"
        className="bg-night-900 px-8 py-5 text-xs font-semibold uppercase tracking-[0.25em] text-cream transition hover:bg-brand-700">
        Check availability
      </button>
    </form>
  );
}
