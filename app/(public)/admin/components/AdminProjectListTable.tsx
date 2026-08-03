import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";
import { SortableHeader } from "./SortableHeader";

export function AdminProjectListTable({
  items,
  sortBy,
  sortDir,
  buildSortHref,
}: {
  items: ProjectListItem[];
  sortBy: string | undefined;
  sortDir: "asc" | "desc";
  buildSortHref: (column: string, direction: "asc" | "desc") => string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos para esta búsqueda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <SortableHeader label="Proyecto" column="name" activeColumn={sortBy} activeDirection={sortDir} buildHref={buildSortHref} />
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Región</th>
            <SortableHeader
              label="MW"
              column="capacityMw"
              activeColumn={sortBy}
              activeDirection={sortDir}
              buildHref={buildSortHref}
              align="right"
            />
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr
              key={p.id}
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
            >
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">{p.name}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.developerCompany ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.region ?? "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                {p.capacityMw !== null ? Math.round(p.capacityMw).toLocaleString("es-CL") : "—"}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/editar-data/${p.id}`}
                  className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                >
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
