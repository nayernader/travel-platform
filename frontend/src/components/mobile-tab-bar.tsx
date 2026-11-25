"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";

const ICONS: Record<string, React.ReactNode> = {
  hotels: <><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M10 21v-5h4v5" /></>,
  flights: <path d="M2 16l20-6-20-6 4 6-4 6zM6 10h8" />,
  explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  favourites: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
};

/** App-style bottom navigation on phones (hidden on large screens). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const tabs = [
    { href: "/hotels", label: "Hotels", icon: "hotels" },
    { href: "/flights", label: "Flights", icon: "flights" },
    { href: "/explore", label: "Explore", icon: "explore" },
    { href: user ? "/favourites" : "/login", label: "Favourites", icon: "favourites" },
    { href: user ? "/profile" : "/login", label: user ? "Account" : "Log in", icon: "account" },
  ];
  return (
    <nav aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-stone-200 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link key={t.label} href={t.href}
            className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium uppercase tracking-wider ${active ? "text-night-900" : "text-stone-500"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[t.icon]}
            </svg>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
