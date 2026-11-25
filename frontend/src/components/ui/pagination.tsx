import { Button } from "./button";

/** Lists are paginated by 10 (GEN-05): <Pagination page={data.page} total={data.total} onPageChange={setPage} /> */
export function Pagination({ page, total, pageSize = 10, onPageChange }: {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</Button>
      <span className="text-sm text-slate-600">Page {page} of {pages} · {total} results</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</Button>
    </nav>
  );
}
