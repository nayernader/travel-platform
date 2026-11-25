import { Card } from "./ui/card";

/** Placeholder for a page a member still has to build. Delete it when you build the real page. */
export function ComingSoon({ title, owner, requirements }: { title: string; owner: string; requirements: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Card>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-slate-600">This page is not built yet.</p>
        <p className="mt-4 text-sm text-slate-500">Owner: {owner} · Requirements: {requirements}</p>
      </Card>
    </div>
  );
}
