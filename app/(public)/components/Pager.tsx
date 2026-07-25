import Link from "next/link";

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
    <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-4">
        {page > 1 && (
          <Link href={buildHref(page - 1)} className="hover:underline">
            ← Anterior
          </Link>
        )}
        {page < totalPages && (
          <Link href={buildHref(page + 1)} className="hover:underline">
            Siguiente →
          </Link>
        )}
      </div>
    </div>
  );
}
