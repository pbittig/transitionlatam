import type {
  CodOutlook,
  CommercialWindow,
  MacroStage,
  NextMilestone,
  ProjectSynthesis,
} from "@/lib/shared/projectIntelligence";
import type { AppLocale } from "@/lib/i18n";

const MACRO_STAGE_COLOR: Record<MacroStage, string> = {
  desarrollo: "light-dark(#2a78d6, #4a90e2)",
  ingenieria: "light-dark(#0e9488, #2dd4bf)",
  compras: "light-dark(#d97706, #f0a020)",
  construccion: "light-dark(#e0653a, #f2825c)",
  comisionamiento: "light-dark(#1baf7a, #22c55e)",
  operativo: "light-dark(#c23a2a, #ef4444)",
  no_iniciado: "light-dark(#737373, #a3a3a3)",
};

const OUTLOOK_COLOR: Record<Exclude<CodOutlook["band"], "no_aplica">, string> = {
  alta: "light-dark(#38d7c5, #38d7c5)",
  media: "light-dark(#c2822a, #eab308)",
  baja: "light-dark(#c23a2a, #ef4444)",
};

const CONFIDENCE_LABEL: Record<AppLocale, Record<string, string>> = {
  es: { alta: "Alta", media: "Media", baja: "Baja" },
  en: { alta: "High", media: "Medium", baja: "Low" },
};

const LOCALIZED_STAGE: Record<AppLocale, Record<MacroStage, string>> = {
  es: { desarrollo: "En desarrollo", ingenieria: "En ingeniería", compras: "En compras", construccion: "En construcción", comisionamiento: "En comisionamiento", operativo: "Debería estar operativo", no_iniciado: "Aún no iniciado" },
  en: { desarrollo: "In development", ingenieria: "In engineering", compras: "In procurement", construccion: "Under construction", comisionamiento: "In commissioning", operativo: "Should be operational", no_iniciado: "Not started yet" },
};

const PHASE_LABEL_EN: Record<string, string> = {
  "Campaña de Medición de Viento": "Wind measurement campaign",
  Desarrollo: "Development",
  "Ingeniería Conceptual": "Conceptual engineering",
  "Ingeniería Básica": "Basic engineering",
  "Ingeniería de Detalle": "Detailed engineering",
  Compras: "Procurement",
  Construcción: "Construction",
  Comisionamiento: "Commissioning",
  "Estudios de Factibilidad / Conexión": "Feasibility / connection studies",
  "Pruebas y Puesta en Servicio": "Testing and start-up",
};

function phaseLabel(label: string, locale: AppLocale): string {
  return locale === "en" ? (PHASE_LABEL_EN[label] ?? label) : label;
}

function synthesisNarrative(synthesis: ProjectSynthesis, locale: AppLocale): string {
  if (locale === "es") return synthesis.narrative;
  if (synthesis.macroStage === "operativo") return "The estimated connection date has passed; the project should already be operational.";
  if (synthesis.macroStage === "no_iniciado") return "Development should not have started yet based on the estimated connection date.";
  return synthesis.currentPhaseLabel ? `We currently estimate that the project is in ${phaseLabel(synthesis.currentPhaseLabel, locale)}.` : "There is not enough schedule information to estimate the current phase.";
}

function outlookLabel(label: string, locale: AppLocale): string {
  if (locale === "es") return label;
  const fixed: Record<string, string> = {
    Base: "Base",
    "RCA aprobada": "Approved RCA",
    "SEIA en trámite": "SEIA assessment in progress",
    "Sin expediente SEIA asociado": "No associated SEIA filing",
    "Proyecto finalizado": "Project completed",
    "Declarado en construcción": "Declared under construction",
    "Trámite de conexión en etapa avanzada": "Grid connection process at an advanced stage",
    "Trámite de conexión todavía en etapa inicial": "Grid connection process still at an early stage",
    "Fecha estimada de conexión ya pasó sin llegar a construcción": "Estimated connection date passed before construction",
  };
  const months = label.match(/^Solo quedan ~([0-9]+) meses para el COD$/);
  return months ? `Only ~${months[1]} months remain until COD` : (fixed[label] ?? label);
}

function fmt(iso: string, locale: AppLocale): string {
  return new Date(iso).toLocaleDateString(locale === "en" ? "en-US" : "es-CL", { month: "long", year: "numeric" });
}

export function ProjectStatusSynthesis({
  synthesis,
  nextMilestone,
  commercialWindow,
  codOutlook,
  locale = "es",
}: {
  synthesis: ProjectSynthesis;
  nextMilestone: NextMilestone | null;
  commercialWindow: CommercialWindow | null;
  codOutlook: CodOutlook;
  locale?: AppLocale;
}) {
  const stageColor = MACRO_STAGE_COLOR[synthesis.macroStage];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stageColor }} />
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {LOCALIZED_STAGE[locale][synthesis.macroStage].toUpperCase()}
          </span>
          {synthesis.confidence && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {locale === "en" ? "Confidence" : "Confianza"} {CONFIDENCE_LABEL[locale][synthesis.confidence]}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full max-w-md rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${synthesis.progressPct}%`, backgroundColor: stageColor }}
          />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">{synthesisNarrative(synthesis, locale)}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {nextMilestone && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Next expected milestone" : "Próximo hito esperado"}</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{phaseLabel(nextMilestone.label, locale)}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {fmt(nextMilestone.expectedDate, locale)} · {locale === "en" ? "confidence" : "confianza"} {CONFIDENCE_LABEL[locale][nextMilestone.confidence]}
            </p>
          </div>
        )}

        {commercialWindow && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Commercial window" : "Ventana comercial"}</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {commercialWindow.status === "abierta" && (locale === "en" ? "Open" : "Abierta")}
              {commercialWindow.status === "cerrada" && (locale === "en" ? "Closed" : "Cerrada")}
              {commercialWindow.status === "aun_no_abre" && (locale === "en" ? "Not open yet" : "Aún no abre")}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {commercialWindow.status === "cerrada"
                ? locale === "en" ? `Closed when construction began (${fmt(commercialWindow.closesAt, locale)})` : `Se cerró al iniciar construcción (${fmt(commercialWindow.closesAt, locale)})`
                : `${fmt(commercialWindow.opensAt, locale)} → ${fmt(commercialWindow.closesAt, locale)}`}
            </p>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              {locale === "en" ? "Estimated period between Procurement and Construction; a likely window for EPC and equipment awards." : "Tramo estimado entre Compras y Construcción — probable ventana para adjudicar EPC/equipos."}
            </p>
          </div>
        )}

        {codOutlook.score !== null && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Probability of meeting COD" : "Probabilidad de cumplir COD"}</p>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: OUTLOOK_COLOR[codOutlook.band as Exclude<typeof codOutlook.band, "no_aplica">] }}
              />
              <span className="text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                {codOutlook.score}%
              </span>
            </div>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs">
              {codOutlook.breakdown.map((step, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-neutral-500 dark:text-neutral-400">
                  <span className="truncate">{outlookLabel(step.label, locale)}</span>
                  <span
                    className={`shrink-0 tabular-nums font-medium ${
                      step.delta > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : step.delta < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-neutral-400 dark:text-neutral-500"
                    }`}
                  >
                    {step.delta > 0 ? "+" : ""}
                    {step.delta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
        {locale === "en" ? "Status, next milestone, commercial window and COD probability are Transition LATAM estimates derived from the probabilistic schedule model and permitting status; they are not verified official data." : "Estatus, próximo hito, ventana comercial y probabilidad de COD son estimaciones propias derivadas del modelo probabilístico de cronograma y del estado de trámite — no son datos oficiales verificados."}
      </p>
    </div>
  );
}
