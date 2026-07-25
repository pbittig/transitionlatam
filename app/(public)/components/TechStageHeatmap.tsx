import type { MarketTechCategory } from "@/lib/shared/marketTechCategories";

export interface HeatmapColumn {
  key: string;
  label: string;
  values: Partial<Record<MarketTechCategory, number>>; // MW por categoría
}

const CELL_HUE_LIGHT = "42, 120, 214"; // #2a78d6 en rgb, para variar opacidad
const CELL_HUE_DARK = "74, 144, 226";

function fmtMw(n: number): string {
  if (n === 0) return "—";
  return Math.round(n).toLocaleString("es-CL");
}

export function TechStageHeatmap({ categories, columns }: { categories: MarketTechCategory[]; columns: HeatmapColumn[] }) {
  const columnMax = columns.map((c) => Math.max(...categories.map((cat) => c.values[cat] ?? 0), 1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[500px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400"></th>
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-1 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat}>
              <td className="pr-3 text-sm font-medium whitespace-nowrap text-neutral-700 dark:text-neutral-300">{cat}</td>
              {columns.map((c, i) => {
                const value = c.values[cat] ?? 0;
                const intensity = Math.min(value / columnMax[i], 1);
                return (
                  <td key={c.key} className="p-0">
                    <div
                      className="rounded-md px-3 py-2 text-right text-xs font-medium tabular-nums"
                      style={{
                        backgroundColor: `light-dark(rgba(${CELL_HUE_LIGHT}, ${0.08 + intensity * 0.55}), rgba(${CELL_HUE_DARK}, ${0.12 + intensity * 0.55}))`,
                        color: intensity > 0.6 ? "white" : "light-dark(#171717, #e5e5e5)",
                      }}
                      title={`${cat} · ${c.label}: ${fmtMw(value)} MW`}
                    >
                      {fmtMw(value)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        MW por tecnología y etapa. Cada columna usa su propia escala de intensidad (Operación, Construcción y Pipeline
        tienen volúmenes muy distintos entre sí).
      </p>
    </div>
  );
}
