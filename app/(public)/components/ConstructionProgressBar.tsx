/** Misma anatomía visual que ThermalStatusBar (compact) — en gris cuando no hay registro PGP, es decir, la construcción aún no ha empezado. */
export function ConstructionProgressBar({ progressPercent }: { progressPercent: number | null }) {
  if (progressPercent === null) {
    return (
      <div className="w-32" title="Sin registro de avance físico en PGP — construcción aún no reportada">
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
          role="progressbar"
          aria-label="Avance de construcción: sin registro"
        />
        <div className="mt-1 text-right text-[11px] font-medium tabular-nums text-neutral-400 dark:text-neutral-600">—</div>
      </div>
    );
  }

  return (
    <div className="w-32" title={`Avance de construcción (PGP): ${progressPercent}%`}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/10"
        role="progressbar"
        aria-label={`Avance de construcción: ${progressPercent}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_10px_rgba(56,215,197,0.22)]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] font-medium tabular-nums text-neutral-500">{progressPercent}%</div>
    </div>
  );
}
