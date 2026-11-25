"use client";

import { ComingSoon } from "@/components/coming-soon";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";

export default function HotelDashboardPage() {
  return (
    <RequireAuth roles={["hotel_moderator"]}>
      <DashboardShell title="Hotel dashboard" items={[{ href: "/dashboard/hotel", label: "Overview" }]}>
        <ComingSoon title="Hotel dashboard" owner="Member 4" requirements="HTL-01 to HTL-10 (hotel, rooms, availability, reservations)" />
      </DashboardShell>
    </RequireAuth>
  );
}
