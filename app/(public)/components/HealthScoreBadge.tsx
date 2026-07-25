import { HEALTH_BAND_COLOR, HEALTH_BAND_LABEL, type HealthScoreResult } from "@/lib/shared/projectHealthScore";

export function HealthScoreBadge({ health, compact }: { health: HealthScoreResult; compact?: boolean }) {
  if (health.score === null) {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
  }
  const color = HEALTH_BAND_COLOR[health.band as Exclude<typeof health.band, "no_aplica">];

  if (compact) {
    return (
      <div className="flex items-center gap-2" title={HEALTH_BAND_LABEL[health.band]}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium tabular-nums text-neutral-900 dark:text-neutral-50">{health.score}</span>
        {health.overdue && (
          <span className="text-xs text-amber-700 dark:text-amber-400" title="Fecha estimada de conexión ya pasó">
            atrasado
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div>
        <p className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{health.score}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{HEALTH_BAND_LABEL[health.band]}</p>
      </div>
    </div>
  );
}
