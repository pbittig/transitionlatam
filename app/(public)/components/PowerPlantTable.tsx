import type { PowerPlantListItem } from "@/lib/data-access/powerPlants";

export function PowerPlantTable({ items }: { items: PowerPlantListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin centrales para este filtro.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
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
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{plant.status ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
