"use client";

import { useEffect } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  /** Red confirm button for destructive actions (cancel booking, delete) */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Ask before anything that cannot be undone.
 *   <ConfirmDialog open={open} title="Cancel this booking?" message="You get a 50% refund." danger
 *     loading={busy} onConfirm={cancel} onCancel={() => setOpen(false)} />
 */
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", danger, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loading && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !loading && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">{title}</h2>
        {message && <div className="mt-2 text-sm text-slate-600">{message}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Back</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
