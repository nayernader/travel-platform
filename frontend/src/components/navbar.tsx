"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import type { Role } from "@/lib/types";
import { Logo } from "./logo";

interface NavLink {
  href: string;
  label: string;
  /** Only shown to these roles; no roles = everyone */
  roles?: Role[];
}

// Add your module's main page here (one line).
const LINKS: NavLink[] = [
  { href: "/flights", label: "Flights" },
  { href: "/hotels", label: "Hotels" },
  { href: "/explore", label: "Explore" },
  { href: "/blog", label: "Blog" },
  { href: "/bookings", label: "Bookings", roles: ["user"] },
  { href: "/itineraries", label: "Itineraries", roles: ["user"] },
  { href: "/favourites", label: "Favourites", roles: ["user"] },
  { href: "/dashboard/airline", label: "Airline dashboard", roles: ["airline_moderator"] },
  { href: "/dashboard/hotel", label: "Hotel dashboard", roles: ["hotel_moderator"] },
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

/** Pages with a full-screen photo hero: the navbar floats over it until you scroll. */
const OVERLAY_PAGES = ["/"];

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overlayPage = OVERLAY_PAGES.includes(pathname);
  const transparent = overlayPage && !scrolled && !open;

  const links = LINKS.filter((l) => !l.roles || (user && l.roles.includes(user.role)));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    `rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition ${
      transparent
        ? isActive(href) ? "bg-white/15 text-white" : "text-white/85 hover:text-white"
        : isActive(href) ? "text-night-900 underline decoration-accent-500 underline-offset-8" : "text-stone-600 hover:text-night-900"
    }`;
  const pill = transparent
    ? "rounded-full border border-white/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-white hover:text-night-900"
    : "rounded-full bg-night-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-brand-700";

  async function onLogout() {
    setOpen(false);
    await logout();
    router.push("/login");
  }

  const account = loading ? null : user ? (
    <>
      <Link href="/profile" onClick={() => setOpen(false)} className={linkClass("/profile")}>{user.name}</Link>
      <button onClick={onLogout} className={pill}>Log out</button>
    </>
  ) : (
    <>
      <Link href="/login" onClick={() => setOpen(false)} className={linkClass("/login")}>Log in</Link>
      <Link href="/register" onClick={() => setOpen(false)} className={pill}>Get started</Link>
    </>
  );

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        transparent ? "bg-gradient-to-b from-black/45 to-transparent" : "border-b border-slate-200/70 bg-white/90 shadow-sm backdrop-blur-xl"
      }`}>
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Logo dark={transparent} />

          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkClass(l.href)}>{l.label}</Link>
            ))}
          </div>
          <div className="hidden items-center gap-2 lg:flex">{account}</div>

          <button className={`rounded-lg p-2 lg:hidden ${transparent ? "text-white" : "text-slate-800"}`} aria-label="Menu"
            aria-expanded={open} onClick={() => setOpen(!open)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </nav>
        {open && (
          <div className="border-t border-stone-200 bg-cream px-4 py-3 lg:hidden">
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={linkClass(l.href)}>{l.label}</Link>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-stone-200 pt-3">{account}</div>
          </div>
        )}
      </header>
      {/* Other pages start below the fixed bar */}
      {!overlayPage && <div aria-hidden className="h-16" />}
    </>
  );
}
