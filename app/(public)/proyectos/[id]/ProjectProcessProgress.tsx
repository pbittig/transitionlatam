import { getSeiaMaturity, isSeiaNegativeTerminal } from "@/lib/shared/seiaStatusMaturity";
import { getStatusMaturity, isRejectedStatus } from "@/lib/shared/projectStatusMaturity";
import { getPertinenciaMaturity, isPertinenciaNegativeTerminal } from "@/lib/shared/pertinenciaStatusMaturity";
import { clasificarConclusionPertinencia } from "@/lib/data-access/pertinencias";
import type { AppLocale } from "@/lib/i18n";

type ProgressState = {
  percentage: number | null;
  label: string;
  terminal: boolean;
};

function ProcessBar({
  title,
  status,
  state,
  locale,
}: {
  title: string;
  status: string;
  state: ProgressState;
  locale: AppLocale;
}) {
  const percentage = state.percentage ?? 0;

  return (
    <div className="rounded-2xl border border-brand-primary/25 bg-gradient-to-r from-brand-surface/80 via-white to-white p-5 shadow-sm dark:from-brand-primary/10 dark:via-neutral-950 dark:to-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-ink dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{status}</p>
        </div>
        <span
          className={
            state.terminal
              ? "rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              : "rounded-full bg-brand-primary/15 px-2.5 py-1 text-xs font-semibold text-brand-deep dark:bg-brand-primary/20 dark:text-brand-primary"
          }
        >
          {state.label}
        </span>
      </div>

      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/10 dark:bg-brand-primary/10"
        role="progressbar"
        aria-label={`${title}: ${state.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={state.percentage ?? undefined}
      >
        {!state.terminal && state.percentage !== null && (
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_14px_rgba(56,215,197,0.28)] transition-[width]"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
        <span>{locale === "en" ? "Start" : "Inicio"}</span>
        <span>{state.percentage === null ? (locale === "en" ? "Progress unavailable" : "Avance no calculable") : `${percentage}% ${locale === "en" ? "estimated progress" : "de avance estimado"}`}</span>
        <span>{locale === "en" ? "Complete" : "Completado"}</span>
      </div>
    </div>
  );
}

export function ProjectProcessProgress({
  connectionStatus,
  environmentalStatus,
  pertinencia,
  locale = "es",
}: {
  connectionStatus: string | null;
  environmentalStatus: string | null;
  pertinencia?: { estado: string | null; subEstado: string | null } | null;
  locale?: AppLocale;
}) {
  const connectionMaturity = getStatusMaturity(connectionStatus);

  const connectionState: ProgressState = {
    percentage: connectionMaturity?.order ?? null,
    label: isRejectedStatus(connectionStatus)
      ? locale === "en" ? "Process ended" : "Proceso terminado"
      : connectionMaturity
        ? `${connectionMaturity.order}%`
        : locale === "en" ? "Progress unavailable" : "Sin avance calculable",
    terminal: isRejectedStatus(connectionStatus),
  };

  // El segundo bloque se adapta a lo que realmente está asociado al proyecto
  // (visible más abajo en la ficha): si hay expediente SEIA formal, manda ese;
  // si no, pero hay una Consulta de Pertinencia confirmada (etapa previa al
  // ingreso a SEIA), muestra esa; si no hay ninguno, queda igual que antes
  // (barra vacía, sin expediente asociado).
  let secondBar: { title: string; status: string; state: ProgressState };
  if (environmentalStatus) {
    const environmentalMaturity = getSeiaMaturity(environmentalStatus);
    secondBar = {
      title: locale === "en" ? "Environmental status" : "Estado ambiental",
      status: environmentalStatus,
      state: {
        percentage: environmentalMaturity?.order ?? null,
        label: isSeiaNegativeTerminal(environmentalStatus)
          ? locale === "en" ? "Process ended" : "Proceso terminado"
          : environmentalMaturity
            ? `${environmentalMaturity.order}%`
            : locale === "en" ? "Progress unavailable" : "Sin avance calculable",
        terminal: isSeiaNegativeTerminal(environmentalStatus),
      },
    };
  } else if (pertinencia) {
    const pertinenciaMaturity = getPertinenciaMaturity(pertinencia.estado, pertinencia.subEstado);
    const pertinenciaTerminal = isPertinenciaNegativeTerminal(pertinencia.subEstado);
    secondBar = {
      title: locale === "en" ? "Pertinence consultation (SEA)" : "Consulta de pertinencia (SEA)",
      status: clasificarConclusionPertinencia(pertinencia.estado, pertinencia.subEstado),
      state: {
        percentage: pertinenciaMaturity?.order ?? null,
        label: pertinenciaTerminal
          ? locale === "en" ? "Process ended" : "Proceso terminado"
          : pertinenciaMaturity
            ? `${pertinenciaMaturity.order}%`
            : locale === "en" ? "Progress unavailable" : "Sin avance calculable",
        terminal: pertinenciaTerminal,
      },
    };
  } else {
    secondBar = {
      title: locale === "en" ? "Environmental status" : "Estado ambiental",
      status: locale === "en" ? "No SEIA filing linked yet" : "Sin expediente SEIA asociado todavía",
      state: { percentage: null, label: locale === "en" ? "No linked filing" : "Sin expediente asociado", terminal: false },
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <ProcessBar
        title={locale === "en" ? "Connection status" : "Estado de conexión"}
        status={connectionStatus ?? (locale === "en" ? "No connection status reported" : "Sin estado de conexión informado")}
        state={connectionState}
        locale={locale}
      />
      <ProcessBar title={secondBar.title} status={secondBar.status} state={secondBar.state} locale={locale} />
      <p className="text-[11px] leading-5 text-neutral-400 dark:text-neutral-500">
        {locale === "en" ? "The percentage is an estimated maturity assessment based on the reported status of each process; it is not an official percentage from the National Electricity Coordinator or SEA." : "El porcentaje representa una lectura estimada de madurez según el estado informado en cada proceso; no corresponde a un porcentaje oficial del Coordinador Eléctrico Nacional ni del SEA."}
      </p>
    </div>
  );
}
