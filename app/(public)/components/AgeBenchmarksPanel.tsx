import type { AgeBenchmarkRow, RequestAgeBenchmarks } from "@/lib/data-access/pipeline";

const BAR_COLOR = "light-dark(#2a78d6, #4a90e2)";

function BenchmarkList({ title, rows }: { title: string; rows: AgeBenchmarkRow[] }) {
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{title}</h3>
        <p className="mt-2 text-sm text-neutral-400 dark:text-neutral-500">Sin datos suficientes.</p>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.avgAgeMonths), 1);
  return (
    <div>
      <h3 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{title}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-neutral-700 dark:text-neutral-300" title={r.label}>
                {r.label}
              </span>
              <span className="shrink-0 tabular-nums text-neutral-900 dark:text-neutral-50">
                {r.avgAgeMonths.toLocaleString("es-CL")} meses
                <span className="ml-1 text-neutral-400 dark:text-neutral-500">({r.count})</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${Math.max((r.avgAgeMonths / max) * 100, 2)}%`, backgroundColor: BAR_COLOR }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgeBenchmarksPanel({ benchmarks }: { benchmarks: RequestAgeBenchmarks }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <BenchmarkList title="Por tecnología" rows={benchmarks.byTechnology} />
      <BenchmarkList title="Por región" rows={benchmarks.byRegion} />
      <BenchmarkList title="PMGD vs. Utility Scale" rows={benchmarks.byPmgdUtility} />
      <BenchmarkList title="Por tamaño" rows={benchmarks.bySizeBucket} />
    </div>
  );
}
