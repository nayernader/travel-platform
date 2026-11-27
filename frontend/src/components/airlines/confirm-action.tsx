"use client";

import { ConfirmDialog } from "@/components/ui";

interface ConfirmActionProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** GEN-03: every cancel or delete goes through this confirmation. */
export function ConfirmAction({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  loading,
  onConfirm,
  onCancel,
}: ConfirmActionProps) {
  return (
    <ConfirmDialog
      danger
      open={open}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}