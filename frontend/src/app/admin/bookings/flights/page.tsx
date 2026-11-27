"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookingCard } from "@/components/flights/booking-card";
import { useZoneOf } from "@/components/flights/use-zone-of";
import { FormErrors } from "@/components/form-errors";
import { Button, ButtonLink, EmptyState, LoadingState, Pagination } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import { BOOKING_GROUPS, parseGroup, type BookingGroup, type BookingList } from "@/lib/types-flights";

const EMPTY: Record<BookingGroup, { title: string; description: string }> = {
  upcoming: { title: "No upcoming flights", description: "Find your next trip and book it in a few steps." },
  past: { title: "No past flights yet", description: "Completed trips will show up here." },
  cancelled: { title: "No cancelled bookings", description: "Bookings you cancel will be listed here." },
};

function BookingsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const zoneOf = useZoneOf();

  const group = parseGroup(params.get("group"));
  const page = Math.max(1, Number(params.get("page")) || 1);

  const { data, errors, loading } = useApi<BookingList>("/flight-bookings", { group, page });

  // GEN-14: group and page live in the URL
  const update = (g: BookingGroup, p: number) => {
    const next = new URLSearchParams();
    next.set("group", g);
    if (p > 1) next.set("page", String(p));
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Booking groups">
        {BOOKING_GROUPS.map((g) => (
          <Button key={g.value} type="button" size="sm"
            variant={group === g.value ? "primary" : "outline"}
            onClick={() => update(g.value, 1)}>
            {g.label}
          </Button>
        ))}
      </div>

      {loading && <LoadingState label="Loading your bookings..." />}
      {errors && <FormErrors messages={errors} />}

      {data && !loading && !errors && (
        <>
          {!data.items.length && (
            <EmptyState
              title={EMPTY[group].title}
              description={EMPTY[group].description}
              action={<ButtonLink href="/flights">Search flights</ButtonLink>}
            />
          )}
          <div className="space-y-3">
            {data.items.map((b) => <BookingCard key={b._id} b={b} zoneOf={zoneOf} />)}
          </div>
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onPageChange={(p) => update(group, p)} />
        </>
      )}
    </div>
  );
}

export default function MyFlightBookingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <BookingsContent />
    </Suspense>
  );
}