import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";

function SubmissionTypeTag({ submissionType }: { submissionType?: string | null }) {
  if (!submissionType) return null;
  return (
    <span
      className="ml-1.5 shrink-0 rounded border px-1 py-0.5 text-[10px] font-semibold leading-none text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
      title={
        submissionType === "EIA"
          ? "Estudio de Impacto Ambiental"
          : submissionType === "DIA"
            ? "Declaración de Impacto Ambiental"
            : submissionType
      }
    >
      {submissionType}
    </span>
  );
}

export function SeiaStatusBar({
  status,
  submissionType,
  compact = false,
}: {
  status: string | null;
  submissionType?: string | null;
  compact?: boolean;
}) {
  if (!status) return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;

  if (isSeiaNegativeTerminal(status)) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{status}</span>
        <SubmissionTypeTag submissionType={submissionType} />
      </div>
    );
  }

  const maturity = getSeiaMaturity(status);
  if (!maturity) {
    return (
      <span className="text-sm text-neutral-600 dark:text-neutral-400">
        {status}
        <SubmissionTypeTag submissionType={submissionType} />
      </span>
    );
  }

  return (
    <div className={compact ? "w-32" : "w-28"} title={status}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/10"
        role="progressbar"
        aria-label={`Estado ambiental: ${maturity.order}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={maturity.order}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_10px_rgba(56,215,197,0.22)]"
          style={{ width: `${maturity.order}%` }}
        />
      </div>
      {compact ? (
        <div className="mt-1 text-right text-[11px] font-medium tabular-nums text-neutral-500">
          {maturity.order}%
        </div>
      ) : (
        <div className="mt-1 flex items-center text-xs text-neutral-500 dark:text-neutral-400">
          {status}
          <SubmissionTypeTag submissionType={submissionType} />
        </div>
      )}
    </div>
  );
}
