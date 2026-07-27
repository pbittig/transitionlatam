import Link from "next/link";

/** Encabezado de columna estilo Excel: clic ordena por esa columna, clic de nuevo invierte la dirección. */
export function SortableHeader({
  label,
  column,
  activeColumn,
  activeDirection,
  buildHref,
  align = "left",
}: {
  label: string;
  column: string;
  activeColumn: string | undefined;
  activeDirection: "asc" | "desc";
  buildHref: (column: string, direction: "asc" | "desc") => string;
  align?: "left" | "right";
}) {
  const active = activeColumn === column;
  const nextDirection: "asc" | "desc" = active && activeDirection === "asc" ? "desc" : "asc";

  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : ""}`}>
      <Link
        href={buildHref(column, nextDirection)}
        className={`inline-flex items-center gap-1 hover:text-neutral-900 dark:hover:text-neutral-100 ${
          active ? "text-neutral-900 dark:text-neutral-100" : ""
        }`}
      >
        {label}
        {active && <span aria-hidden>{activeDirection === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}
