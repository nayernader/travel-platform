"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { RequireAuth } from "@/components/require-auth";

// Every admin page, in sidebar order. Owners in comments. Add a line only for a NEW page.
const ADMIN_ITEMS = [
  { href: "/admin", label: "Overview" },                // Member 8
  { href: "/admin/accounts", label: "Accounts" },       // Member 8 (ACC-14, ACC-16; reset password button: Member 1)
  { href: "/admin/moderators", label: "Moderators" },   // Member 8 (ACC-13)
  { href: "/admin/providers", label: "Airlines & hotels" }, // Member 8 (ACC-15; create forms from Members 2 and 4)
  { href: "/admin/bookings", label: "Bookings" },       // Member 8 (ACC-17)
  { href: "/admin/reports", label: "Reports" },         // Member 8 (GEN-09, GEN-10)
  { href: "/admin/audit-logs", label: "Audit log" },    // Member 1 (GEN-07)
  { href: "/admin/analytics", label: "Analytics" },     // Member 1 (BON-01)
];

/** Admin console frame: login + admin role check, sidebar on desktop, tabs on phones. Pages only render their content. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth roles={["admin"]}>
      <DashboardShell title="Administration" items={ADMIN_ITEMS}>{children}</DashboardShell>
    </RequireAuth>
  );
}
