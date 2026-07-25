import type { MilestoneMonthEntry } from "@/lib/shared/scheduleForecast";

function monthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
}

export function MilestoneCalendarChart({
  entries,
  color,
}: {
  entries: MilestoneMonthEntry[];
  /** Ya en formato `light-dark(...)` — ver PHASE_COLORS en lib/shared/projectPhaseDurations.ts. */
  color: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos con este hito en el rango.</p>;
  }
  const max = Math.max(...entries.map((e) => e.capacityMw), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[700px] items-end gap-1.5" style={{ height: 130 }}>
        {entries.map((e) => {
          const heightPct = Math.max((e.capacityMw / max) * 100, 2);
          return (
            <div key={e.yearMonth} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
              <span className="text-[10px] tabular-nums text-neutral-500 dark:text-neutral-400">
                {Math.round(e.capacityMw).toLocaleString("es-CL")} MW
              </span>
              <div
                className="w-full max-w-6 rounded-t-sm"
                style={{ height: `${heightPct}%`, backgroundColor: color }}
                title={`${monthLabel(e.yearMonth)}: ${e.count} proyectos · ${Math.round(e.capacityMw).toLocaleString("es-CL")} MW`}
              />
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">{monthLabel(e.yearMonth)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
