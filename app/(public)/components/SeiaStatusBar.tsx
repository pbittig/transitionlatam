import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";

const THERMAL_GRADIENT = "linear-gradient(90deg, #2a78d6 0%, #1baf7a 45%, #0ca30c 100%)";

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
    <div className="w-28">
      <div className="relative h-1.5 rounded-full" style={{ background: THERMAL_GRADIENT }}>
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow dark:border-neutral-900"
          style={{ left: `${maturity.order}%`, backgroundColor: "#0b0b0b" }}
          title={status}
        />
      </div>
      {compact ? (
        <div className="mt-1 text-right text-xs font-medium tabular-nums text-neutral-500 dark:text-neutral-400">
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
