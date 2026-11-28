"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { SeatStep } from "@/components/flights/seat-step";
import { ButtonLink, LoadingState, PageContainer, PageHeader } from "@/components/ui";

function SeatsContent() {
  const { id } = useParams<{ id: string }>();
  const checkout = useSearchParams().get("next") === "checkout";
  const done = checkout ? `/checkout/flight/${id}` : `/bookings/flights/${id}`;

  return (
    <PageContainer size="md">
      <PageHeader
        title="Choose your seats"
        description="Infants travel on an adult's lap and take no seat."
        actions={<ButtonLink href={`/bookings/flights/${id}`} variant="outline">Back to booking</ButtonLink>}
      />
      <SeatStep
        bookingId={String(id)}
        continueHref={done}
        continueLabel={checkout ? "Continue to payment" : "Done"}
      />
    </PageContainer>
  );
}

export default function SeatsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequireAuth roles={["user"]}>
        <SeatsContent />
      </RequireAuth>
    </Suspense>
  );
}