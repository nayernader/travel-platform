"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import {
  Alert,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Input,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { useAuth } from "@/context/auth-context";
import { api, errorMessages } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { Airline } from "@/lib/types-airlines";

interface TierRow {
  daysBefore: string;
  refundPercent: string;
}

export default function PoliciesPage() {
  const { user } = useAuth();
  const airlineId = user?.providerId;
  if (!airlineId) {
    return (
      <EmptyState
        title="No airline assigned"
        description="Ask an administrator to link your account to an airline."
      />
    );
  }
  return <PoliciesLoader id={String(airlineId)} />;
}

function PoliciesLoader({ id }: { id: string }) {
  const { data, errors, loading } = useApi<Airline>(`/airlines/${id}`);
  if (loading) return <LoadingState />;
  if (errors) return <FormErrors messages={errors} />;
  if (!data) return null;
  return (
    <>
      <PageHeader title="Policies" description="Baggage and cancellation rules for all your flights" />
      <div className="space-y-6">
        <BaggageForm airline={data} />
        <TiersForm airline={data} />
      </div>
    </>
  );
}

/** FLT-08 */
function BaggageForm({ airline }: { airline: Airline }) {
  const [price, setPrice] = useState(String(airline.baggagePolicy?.pricePerExtraBag ?? ""));
  const [max, setMax] = useState(String(airline.baggagePolicy?.maxExtraBags ?? ""));
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.put(`/airlines/${airline._id}/baggage-policy`, {
        pricePerExtraBag: Number(price),
        maxExtraBags: Number(max),
      });
      setSaved(true);
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Extra baggage</CardTitle>
      <form onSubmit={save} className="mt-4 space-y-4">
        <FormErrors messages={errors} />
        {saved && <Alert tone="success">Baggage policy saved.</Alert>}
        <Input
          label="Price per extra bag"
          type="number"
          min={0.01}
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <Input
          label="Max extra bags per passenger"
          type="number"
          min={0}
          step="1"
          required
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </form>
    </Card>
  );
}

/** FLT-09 */
function TiersForm({ airline }: { airline: Airline }) {
  const initial: TierRow[] = (airline.cancellationPolicy ?? []).map((t) => ({
    daysBefore: String(t.daysBefore),
    refundPercent: String(t.refundPercent),
  }));
  const [tiers, setTiers] = useState<TierRow[]>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function update(i: number, field: keyof TierRow, value: string) {
    setTiers(tiers.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaved(false);
    setBusy(true);
    try {
      await api.put(`/airlines/${airline._id}/cancellation-policy`, {
        tiers: tiers.map((t) => ({
          daysBefore: Number(t.daysBefore),
          refundPercent: Number(t.refundPercent),
        })),
      });
      setSaved(true);
    } catch (err) {
      setErrors(errorMessages(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Cancellation tiers</CardTitle>
      <form onSubmit={save} className="mt-4 space-y-4">
        <FormErrors messages={errors} />
        {saved && <Alert tone="success">Cancellation policy saved.</Alert>}
        {tiers.length === 0 && (
          <p className="text-sm">No tiers yet: every cancellation refunds 0%. Add a tier below.</p>
        )}
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
            <Input
              label="Days before departure"
              type="number"
              min={0}
              step="1"
              required
              value={t.daysBefore}
              onChange={(e) => update(i, "daysBefore", e.target.value)}
            />
            <Input
              label="Refund %"
              type="number"
              min={0}
              max={100}
              required
              value={t.refundPercent}
              onChange={(e) => update(i, "refundPercent", e.target.value)}
            />
            <Button type="button" variant="ghost" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
              Remove
            </Button>
          </div>
        ))}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setTiers([...tiers, { daysBefore: "", refundPercent: "" }])}
          >
            Add tier
          </Button>
          <Button type="submit" loading={busy}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}