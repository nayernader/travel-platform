"use client";

import { ComingSoon } from "@/components/coming-soon";
import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";

export default function AdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <DashboardShell title="Administration" items={[{ href: "/admin", label: "Overview" }]}>
        <ComingSoon title="Administration" owner="Member 8 (analytics: Member 1)"
          requirements="ACC-13 to ACC-17, GEN-09, GEN-10, BON-01" />
      </DashboardShell>
    </RequireAuth>
  );
}
