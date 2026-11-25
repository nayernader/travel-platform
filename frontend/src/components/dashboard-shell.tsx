"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface DashboardItem {
  href: string;
  label: string;
}

/**
 * Layout for moderator and admin dashboards: a sidebar on desktop, tabs on phones.
 *   <DashboardShell title="Airline dashboard" items={[{ href: "/dashboard/airline", label: "Flights" }, ...]}>...</DashboardShell>
 */
export function DashboardShell({ title, items, children }: { title: string; items: DashboardItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
          {items.map((item) => (
            <Link key={item.href} href={item.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(item.href) ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}
