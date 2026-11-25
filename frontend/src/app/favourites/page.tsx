"use client";

import { ComingSoon } from "@/components/coming-soon";
import { RequireAuth } from "@/components/require-auth";

export default function FavouritesPage() {
  return (
    <RequireAuth roles={["user"]}>
      <ComingSoon title="Favourites" owner="Member 1" requirements="BON-02 (bonus)" />
    </RequireAuth>
  );
}
