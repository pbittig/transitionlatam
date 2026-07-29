import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pager({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="rounded-full bg-brand-surface px-3 py-1.5 font-semibold tabular-nums text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link
            href={buildHref(page - 1)}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/40 px-3 py-2 font-medium text-brand-deep transition hover:bg-brand-surface dark:text-brand-primary dark:hover:bg-brand-primary/10"
          >
            <ChevronLeft size={16} />
            Anterior
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700">
            <ChevronLeft size={16} />
            Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={buildHref(page + 1)}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-deep px-3 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-ink dark:bg-brand-primary dark:text-brand-ink"
          >
            Siguiente
            <ChevronRight size={16} />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-neutral-300 dark:border-neutral-800 dark:text-neutral-700">
            Siguiente
            <ChevronRight size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
