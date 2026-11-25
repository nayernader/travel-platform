type Tone = "error" | "success" | "warning" | "info";

const TONES: Record<Tone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-brand-200 bg-brand-50 text-brand-800",
};

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children?: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}
