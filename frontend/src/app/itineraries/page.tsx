"use client";

import { ComingSoon } from "@/components/coming-soon";
import { RequireAuth } from "@/components/require-auth";

export default function ItinerariesPage() {
  return (
    <RequireAuth roles={["user"]}>
      <ComingSoon title="My itineraries" owner="Member 7" requirements="ITN-01 to ITN-19 (days, activities, budget, PDF)" />
    </RequireAuth>
  );
}
