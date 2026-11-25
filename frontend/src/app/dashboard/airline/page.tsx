"use client";

import { ComingSoon } from "@/components/coming-soon";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";

export default function AirlineDashboardPage() {
  return (
    <RequireAuth roles={["airline_moderator"]}>
      <DashboardShell title="Airline dashboard" items={[{ href: "/dashboard/airline", label: "Overview" }]}>
        <ComingSoon title="Airline dashboard" owner="Member 2" requirements="FLT-01 to FLT-10, FLT-30 (airline, flights, cabins)" />
      </DashboardShell>
    </RequireAuth>
  );
}
