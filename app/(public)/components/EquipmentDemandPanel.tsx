import type { EquipmentDemandEntry } from "@/lib/shared/scheduleForecast";

const BAR_COLOR = "light-dark(#d97706, #f0a020)";

export function EquipmentDemandPanel({ entries }: { entries: EquipmentDemandEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos entrando a etapa de Compras en el rango.</p>;
  }

  const byYear = new Map<number, EquipmentDemandEntry[]>();
  for (const e of entries) {
    const list = byYear.get(e.year) ?? [];
    list.push(e);
    byYear.set(e.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const maxCapacity = Math.max(...entries.map((e) => e.capacityMw), 1);

  return (
    <div className="flex flex-col gap-5">
      {years.map((year) => {
        const rows = [...byYear.get(year)!].sort((a, b) => b.capacityMw - a.capacityMw);
        return (
          <div key={year}>
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{year}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {rows.map((r) => (
                <li key={r.technologyGroup}>
                  <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate text-neutral-700 dark:text-neutral-300">{r.technologyGroup}</span>
                    <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-50">
                      {Math.round(r.capacityMw).toLocaleString("es-CL")} MW
                      <span className="ml-1 text-neutral-400 dark:text-neutral-500">({r.count})</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${Math.max((r.capacityMw / maxCapacity) * 100, 2)}%`, backgroundColor: BAR_COLOR }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        MW de proyectos que entrarían a etapa de Compras cada año, como proxy de demanda de equipos — no un conteo de
        unidades (transformadores, inversores, PCS): no tenemos factores de conversión MW→unidad reales para eso.
        Estimación de mercado, no un dato confirmado por proyecto.
      </p>
    </div>
  );
}
