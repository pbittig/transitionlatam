import type { PowerPlantListItem } from "@/lib/data-access/powerPlants";

export function PowerPlantTable({ items }: { items: PowerPlantListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin centrales para este filtro.</p>;
  }

  return (
    <>
      <div className="grid gap-3 p-3 md:hidden">
        {items.map((plant) => (
          <article key={plant.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold leading-snug text-neutral-900 dark:text-white">{plant.name}</h3>
              <span className="shrink-0 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-semibold tabular-nums text-brand-deep dark:text-brand-primary">
                {plant.netCapacityMw !== null ? `${Math.round(plant.netCapacityMw).toLocaleString("es-CL")} MW` : "—"}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">{plant.ownerName ?? "Propietario sin informar"}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>{[plant.comuna, plant.region].filter(Boolean).join(", ") || "Ubicación sin informar"}</span>
              <span aria-hidden>·</span>
              <span>{plant.status ?? "Sin estado"}</span>
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Central</th>
            <th className="px-4 py-3 font-medium">Propietario</th>
            <th className="px-4 py-3 font-medium">Ubicación</th>
            <th className="px-4 py-3 text-right font-medium">MW</th>
            <th className="px-4 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((plant) => (
            <tr
              key={plant.id}
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
            >
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">{plant.name}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{plant.ownerName ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                {[plant.comuna, plant.region].filter(Boolean).join(", ") || "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                {plant.netCapacityMw !== null ? Math.round(plant.netCapacityMw).toLocaleString("es-CL") : "—"}
              </td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                  {plant.status ?? "Sin estado"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
