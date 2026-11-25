export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-4" }[size];
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${px}`}
    />
  );
}

/** Full-width loading block for pages and lists */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-brand-600">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
