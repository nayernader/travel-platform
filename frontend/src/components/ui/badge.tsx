type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-100 text-brand-800",
  success: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  info: "bg-accent-100 text-accent-700",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

// GEN-11 booking lifecycle, the same names as the backend's BookingStatus
const STATUS: Record<string, { tone: Tone; label: string }> = {
  PENDING_PAYMENT: { tone: "warning", label: "Pending payment" },
  CONFIRMED: { tone: "success", label: "Confirmed" },
  COMPLETED: { tone: "info", label: "Completed" },
  EXPIRED: { tone: "neutral", label: "Expired" },
  CANCELLED: { tone: "danger", label: "Cancelled" },
};

/** <StatusBadge status={booking.status} /> */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "neutral" as Tone, label: status };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
