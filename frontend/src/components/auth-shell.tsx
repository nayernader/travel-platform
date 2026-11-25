import { Card } from "./ui/card";

const POINTS = ["Book flights and hotels in minutes", "Plan every day with a live budget", "Share itineraries with travelers"];

/** Two-column layout for login, register and password pages: a dark brand panel and the form. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-slate-50">
      <div aria-hidden className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-accent-200/50 blur-3xl" />
      <div className="relative mx-auto grid max-w-5xl gap-0 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div className="relative hidden overflow-hidden rounded-l-3xl bg-night-900 p-10 text-white lg:block">
          <div aria-hidden className="absolute -bottom-24 -left-24 h-80 w-80 animate-aurora rounded-full bg-brand-600/50 blur-3xl" />
          <div aria-hidden className="absolute -right-16 top-10 h-60 w-60 animate-aurora rounded-full bg-accent-500/30 blur-3xl [animation-delay:-5s]" />
          <div className="relative">
            <h2 className="text-3xl font-bold leading-tight">Your next trip<br /><span className="text-gradient">starts here.</span></h2>
            <ul className="mt-8 space-y-4">
              {POINTS.map((p) => (
                <li key={p} className="flex items-center gap-3 text-slate-300">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-500/20 text-accent-300">✓</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Card className="rounded-3xl p-8 shadow-xl shadow-slate-900/5 sm:p-10 lg:rounded-l-none">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}
