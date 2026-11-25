import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  const col = "space-y-3 text-sm text-stone-300";
  const head = "mb-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-accent-300";
  return (
    <footer className="bg-night-900 text-stone-300">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo dark />
          <p className="mt-5 max-w-sm font-display text-2xl italic leading-snug text-stone-200">
            Flights, hotels and itineraries, curated in one calm place.
          </p>
        </div>
        <div>
          <p className={head}>Travel</p>
          <ul className={col}>
            <li><Link href="/hotels" className="hover:text-white">Hotels</Link></li>
            <li><Link href="/flights" className="hover:text-white">Flights</Link></li>
            <li><Link href="/explore" className="hover:text-white">Explore trips</Link></li>
          </ul>
        </div>
        <div>
          <p className={head}>Community</p>
          <ul className={col}>
            <li><Link href="/blog" className="hover:text-white">Stories</Link></li>
            <li><Link href="/register" className="hover:text-white">Become a member</Link></li>
            <li><Link href="/login" className="hover:text-white">Member login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-6 text-center text-xs tracking-wider text-stone-500">
        Travel Platform · Software Project I
      </div>
    </footer>
  );
}
