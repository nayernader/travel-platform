"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { PageContainer, PageHeader } from "@/components/ui";

const TABS = [
  { href: "/bookings/flights", label: "Flights" }, // Member 3
  { href: "/bookings/hotels", label: "Hotels" },   // Member 5
];

/** Shared frame for "My bookings". Member 3 owns /bookings/flights/*, Member 5 owns /bookings/hotels/*. */
export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RequireAuth roles={["user"]}>
      <PageContainer>
        <PageHeader title="My bookings" description="Upcoming, past and cancelled trips" />
        <nav className="mb-6 flex gap-2 border-b border-sand">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-slate-900"
                }`}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </PageContainer>
    </RequireAuth>
  );
}
