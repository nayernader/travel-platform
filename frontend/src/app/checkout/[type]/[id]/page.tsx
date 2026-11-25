"use client";

import { useParams } from "next/navigation";
import { ComingSoon } from "@/components/coming-soon";
import { RequireAuth } from "@/components/require-auth";

/**
 * Shared checkout: /checkout/flight/<bookingId> or /checkout/hotel/<bookingId>.
 * Members 3 and 5 send the user here right after the hold is created (Pending Payment).
 * After payment Member 6 sends them to /bookings/flights/<id> or /bookings/hotels/<id>.
 */
export default function CheckoutPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  return (
    <RequireAuth roles={["user"]}>
      <ComingSoon title={`Checkout (${type} ${id})`} owner="Member 6"
        requirements="PAY-02 policies and acceptance, PAY-01 Stripe payment within the 10-minute hold" />
    </RequireAuth>
  );
}
