"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";

const AIRLINE_ITEMS = [
  { href: "/dashboard/airline", label: "Flights" },               // FLT-03, FLT-05, FLT-06, FLT-30
  { href: "/dashboard/airline/new-flight", label: "New flight" }, // FLT-03, FLT-04
  { href: "/dashboard/airline/profile", label: "Airline profile" }, // FLT-01 (name, code, logo)
  { href: "/dashboard/airline/policies", label: "Policies" },     // FLT-08 baggage, FLT-09 cancellation tiers
];

export default function AirlineLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["airline_moderator"]}>
      <DashboardShell title="Airline dashboard" items={AIRLINE_ITEMS}>{children}</DashboardShell>
    </RequireAuth>
  );
}