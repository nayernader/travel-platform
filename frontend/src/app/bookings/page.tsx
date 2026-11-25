"use client";

import { ComingSoon } from "@/components/coming-soon";
import { RequireAuth } from "@/components/require-auth";

export default function BookingsPage() {
  return (
    <RequireAuth roles={["user"]}>
      <ComingSoon title="My bookings" owner="Member 3 (flights) and Member 5 (hotels); payments by Member 6"
        requirements="FLT-23 to FLT-26, HTL-20 to HTL-22, PAY-01 to PAY-03" />
    </RequireAuth>
  );
}
