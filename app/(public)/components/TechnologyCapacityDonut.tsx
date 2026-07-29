import { techColor } from "@/lib/shared/chartColors";
import { operationPlantTypeToCategory } from "@/lib/shared/marketTechCategories";

const FALLBACK_COLORS = ["#0f766e", "#2563eb", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];

export function TechnologyCapacityDonut({
  technologies,
}: {
  technologies: Array<{ technology: string; capacityMw: number; count: number }>;
}) {
  const items = technologies.filter((item) => item.capacityMw > 0);
  const totalMw = items.reduce((sum, item) => sum + item.capacityMw, 0);
  const circumference = 2 * Math.PI * 42;
  const fractions = items.map((item) => (totalMw > 0 ? item.capacityMw / totalMw : 0));
  const cumulativeBefore = fractions.map((_, index) => fractions.slice(0, index).reduce((sum, f) => sum + f, 0));

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[210px_1fr]">
      <div className="relative mx-auto size-52">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Participación de capacidad por tecnología">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="14" className="text-neutral-100 dark:text-neutral-800" />
          {items.map((item, index) => {
            const length = fractions[index] * circumference;
            const offset = -cumulativeBefore[index] * circumference;
            const category = operationPlantTypeToCategory(item.technology);
            const color = category ? techColor(category).light : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
            return (
              <circle
                key={item.technology}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold text-neutral-950 dark:text-white">
            {(totalMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}
          </span>
          <span className="text-xs text-neutral-500">GW instalados</span>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {items.map((item, index) => {
          const share = totalMw > 0 ? (item.capacityMw / totalMw) * 100 : 0;
          const category = operationPlantTypeToCategory(item.technology);
          const color = category ? techColor(category).light : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
          return (
            <li key={item.technology} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="truncate text-neutral-600 dark:text-neutral-300">{item.technology}</span>
              <span className="font-medium tabular-nums text-neutral-900 dark:text-white">{share.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
