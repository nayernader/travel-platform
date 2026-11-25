"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DestinationCarousel } from "@/components/destination-carousel";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { WhereWeFly } from "@/components/where-we-fly";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { MEDIA } from "@/lib/media";

const TILES = [
  { name: "hotels", label: "Hotels", text: "Rooms free for your dates", href: "/hotels", gradient: "from-stone-300 to-stone-600" },
  { name: "flights", label: "Flights", text: "Cabins, seats and fares", href: "/flights", gradient: "from-sky-100 to-stone-500" },
  { name: "explore", label: "Itineraries", text: "Trips shared by travelers", href: "/explore", gradient: "from-amber-100 to-stone-500" },
  { name: "stories", label: "Stories", text: "Notes from the road", href: "/blog", gradient: "from-rose-100 to-stone-500" },
];

const PROMISES = [
  { title: "Secure payment", text: "Card payments through Stripe, never stored by us.",
    icon: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h3" /></> },
  { title: "Clear cancellation", text: "See your refund before you cancel, every time.",
    icon: <><path d="M4 12a8 8 0 1 0 2.3-5.7" /><path d="M4 4v4h4" /></> },
  { title: "Your seat, your room", text: "Choose seats on the plane and several rooms at once.",
    icon: <><path d="M6 19V9a4 4 0 0 1 4-4h0a4 4 0 0 1 4 4v6h4v4" /><path d="M6 15h8" /></> },
  { title: "A budget that adds up", text: "Every cost converted into your own currency.",
    icon: <><path d="M12 3v18" /><path d="M17 7H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6" /></> },
  { title: "Plan day by day", text: "Activities, notes and transport between cities.",
    icon: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></> },
  { title: "Share and inspire", text: "Publish your itinerary or clone someone else's.",
    icon: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" /></> },
];

export default function HomePage() {
  const { user } = useAuth();
  const [online, setOnline] = useState<boolean | null>(null);

  // Integration check: public reference data through the /api proxy
  useEffect(() => {
    api.get("/reference/countries").then(() => setOnline(true)).catch(() => setOnline(false));
  }, []);

  return (
    <>
      <HeroSlideshow greeting={user ? `Welcome back, ${user.name}. Where would you like to go next?` : undefined} />

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center">
        <Reveal>
          <svg className="mx-auto text-accent-500" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2 13.9 10.1 22 12 13.9 13.9 12 22 10.1 13.9 2 12 10.1 10.1Z" />
          </svg>
          <h2 className="mt-6 font-display text-4xl leading-tight sm:text-6xl">
            Travel, <em className="italic">thoughtfully</em> arranged.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">
            From the old bazaars of Cairo to quiet temples in Tokyo, we bring the flight, the room and the plan together,
            so the only thing left to decide is where to have dinner.
          </p>
        </Reveal>
      </section>

      {/* Image tiles */}
      <section className="mx-auto max-w-7xl px-6 pb-28">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {TILES.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <Link href={t.href} className="group relative block aspect-[3/4] overflow-hidden rounded-sm">
                <Photo src={MEDIA.tile(t.name)} alt={t.label} gradient={t.gradient}
                  className="transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <h3 className="font-display text-3xl">{t.label}</h3>
                  <p className="mt-1 flex items-center justify-between text-sm text-white/80">
                    {t.text}
                    <span aria-hidden className="translate-x-0 transition-transform group-hover:translate-x-1">→</span>
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* City slider */}
      <section className="bg-sand/60">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <DestinationCarousel />
        </div>
      </section>

      {/* Stay / Fly split */}
      <section className="grid md:grid-cols-2">
        {[
          { src: MEDIA.stay, title: "Stay", sub: "Hotels in eight cities", href: "/hotels", gradient: "from-stone-400 via-stone-600 to-night-800" },
          { src: MEDIA.fly, title: "Fly", sub: "Flights between them all", href: "/flights", gradient: "from-sky-200 via-stone-500 to-night-800" },
        ].map((c) => (
          <Link key={c.title} href={c.href} className="group relative flex min-h-[70vh] items-end overflow-hidden">
            <Photo src={c.src} alt={c.title} gradient={c.gradient} className="transition-transform duration-[1500ms] ease-out group-hover:scale-105" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="relative p-10 text-white sm:p-14">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">{c.sub}</p>
              <h2 className="mt-3 font-display text-6xl italic sm:text-7xl">{c.title}</h2>
              <span className="mt-6 inline-flex items-center gap-3 border-b border-white/50 pb-1 text-[11px] font-semibold uppercase tracking-[0.25em] transition-all group-hover:gap-5 group-hover:border-white">
                Discover <span aria-hidden>→</span>
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* Promises */}
      <section className="mx-auto max-w-7xl px-6 py-28">
        <Reveal className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent-600">Why Travel Platform?</p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            Small promises, <em className="italic">kept every time.</em>
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-x-12 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {PROMISES.map((p, i) => (
            <Reveal key={p.title} delay={(i % 3) * 120} className="flex gap-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-accent-300 text-accent-600">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {p.icon}
                </svg>
              </span>
              <div>
                <h3 className="font-display text-2xl">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-stone-600">{p.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Where we fly */}
      <section className="relative overflow-hidden bg-night-900">
        <div aria-hidden className="absolute -left-40 top-0 h-[480px] w-[480px] rounded-full bg-accent-500/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-6 py-28">
          <WhereWeFly />
        </div>
      </section>

      {/* Member promo */}
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-28 md:grid-cols-2">
        <Reveal className="relative aspect-[4/3] overflow-hidden rounded-sm">
          <Photo src={MEDIA.promo} alt="Travelers walking through an old town" gradient="from-amber-100 via-stone-400 to-stone-700" />
        </Reveal>
        <Reveal delay={150}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent-600">{user ? "Your account" : "Membership"}</p>
          <h2 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            {user ? <>Your next itinerary <em className="italic">is waiting.</em></> : <>Become a member, <em className="italic">it&apos;s free.</em></>}
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-stone-600">
            {user
              ? "Add days, activities and a budget, then share it with the community."
              : "Keep every booking, e-ticket and itinerary in one place, save favourite hotels, and book faster next time."}
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href={user ? "/itineraries" : "/register"}
              className="rounded-full bg-night-900 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-cream transition hover:bg-brand-700">
              {user ? "My itineraries" : "Become a member"}
            </Link>
            <Link href="/explore"
              className="rounded-full border border-night-900/30 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-night-900 transition hover:border-night-900">
              Explore trips
            </Link>
          </div>
          <p className="mt-10 flex items-center gap-2 text-xs text-stone-500">
            <span className={`h-2 w-2 rounded-full ${online === null ? "bg-stone-300" : online ? "bg-green-600" : "bg-red-500"}`} />
            {online === null ? "Checking backend…" : online ? "Backend connected" : "Backend not reachable: is it running on port 3001?"}
          </p>
        </Reveal>
      </section>
    </>
  );
}
