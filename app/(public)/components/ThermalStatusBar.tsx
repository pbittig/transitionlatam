import { getStatusMaturity, isRejectedStatus, STATUS_BAND_LABEL } from "@/lib/shared/projectStatusMaturity";

export function ThermalStatusBar({
  status,
  compact = false,
  showPercentage = false,
}: {
  status: string | null;
  compact?: boolean;
  showPercentage?: boolean;
}) {
  if (!status) {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
  }

  if (isRejectedStatus(status)) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{status}</span>
      </div>
    );
  }

  const maturity = getStatusMaturity(status);
  if (!maturity) {
    return <span className="text-sm text-neutral-600 dark:text-neutral-400">{status}</span>;
  }

  if (compact) {
    return (
      <div className="w-32" title={status}>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/10"
          role="progressbar"
          aria-label={`Estado de conexión: ${maturity.order}%`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={maturity.order}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_10px_rgba(56,215,197,0.22)]"
            style={{ width: `${maturity.order}%` }}
          />
        </div>
        {showPercentage && (
          <div className="mt-1 text-right text-[11px] font-medium tabular-nums text-neutral-500">
            {maturity.order}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="relative h-1.5 rounded-full bg-brand-primary/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary"
          style={{ width: `${maturity.order}%` }}
          title={status}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-neutral-500 dark:text-neutral-400">{STATUS_BAND_LABEL[maturity.band]}</span>
        <span className="text-neutral-400 dark:text-neutral-500">{maturity.order}%</span>
      </div>
    </div>
  );
}
