import Link from "next/link";

/** Wordmark: a serif name with a small compass star */
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${dark ? "text-white" : "text-night-900"}`}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
        <circle cx="12" cy="12" r="10.5" />
        <path d="M12 3.5 13.6 10.4 20.5 12 13.6 13.6 12 20.5 10.4 13.6 3.5 12 10.4 10.4Z" fill="currentColor" stroke="none" opacity=".9" />
      </svg>
      <span className="font-display text-2xl font-medium leading-none tracking-wide">
        Travel <em className="font-normal italic">Platform</em>
      </span>
    </Link>
  );
}
