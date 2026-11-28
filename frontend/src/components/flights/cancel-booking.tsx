"use client";

import { useState } from "react";
import { FormErrors } from "@/components/form-errors";
import { Button, ConfirmDialog } from "@/components/ui";
import { api, errorMessages } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { CancelResult, FlightBooking, RefundPreview } from "@/lib/types-flights";
import { hasDeparted } from "@/lib/types-flights";

/** FLT-26: preview -> ConfirmDialog (GEN-03) -> cancel. Hidden when not CONFIRMED or already departed. */
export function CancelBooking({ booking, now, onCancelled }: {
  booking: FlightBooking;
  now: number;
  onCancelled: (r: CancelResult) => void;
}) {
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  if (booking.status !== "CONFIRMED" || hasDeparted(booking, now)) return null;

  async function start() {
    setErrors([]);
    setBusy(true);
    try {
      setPreview(await api.get<RefundPreview>(`/flight-bookings/${booking._id}/refund-preview`));
      setOpen(true);
    } catch (e) {
      setErrors(errorMessages(e)); // GEN-13, e.g. 409
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const r = await api.post<CancelResult>(`/flight-bookings/${booking._id}/cancel`);
      setOpen(false);
      onCancelled(r);
    } catch (e) {
      setOpen(false);
      setErrors(errorMessages(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="danger" loading={busy && !open} onClick={start}>Cancel booking</Button>
      {errors.length > 0 && <FormErrors messages={errors} />}
      <ConfirmDialog
        open={open}
        danger
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
        message={preview && (
          <div className="space-y-1 text-sm">
            <p>Booking total: {formatMoney(preview.totalPrice, preview.currency)}</p>
            <p>Days until departure: {preview.daysRemaining}</p>
            <p>Refund: {preview.refundPercent}%</p>
            <p className="font-medium text-brand-700">
              You will receive {formatMoney(preview.refundAmount, preview.currency)}
            </p>
          </div>
        )}
      />
    </div>
  );
}