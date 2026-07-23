import type {
  CodOutlook,
  CommercialWindow,
  MacroStage,
  NextMilestone,
  ProjectSynthesis,
} from "@/lib/shared/projectIntelligence";

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

const CONFIDENCE_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
}

export function ProjectStatusSynthesis({
  synthesis,
  nextMilestone,
  commercialWindow,
  codOutlook,
}: {
  synthesis: ProjectSynthesis;
  nextMilestone: NextMilestone | null;
  commercialWindow: CommercialWindow | null;
  codOutlook: CodOutlook;
}) {
  const stageColor = MACRO_STAGE_COLOR[synthesis.macroStage];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stageColor }} />
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {synthesis.macroStageLabel.toUpperCase()}
          </span>
          {synthesis.confidence && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Confianza {CONFIDENCE_LABEL[synthesis.confidence]}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full max-w-md rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-1.5 rounded-full"
            style={{ width: `${synthesis.progressPct}%`, backgroundColor: stageColor }}
          />
        </div>
        <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">{synthesis.narrative}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {nextMilestone && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Próximo hito esperado</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{nextMilestone.label}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {fmt(nextMilestone.expectedDate)} · confianza {CONFIDENCE_LABEL[nextMilestone.confidence]}
            </p>
          </div>
        )}

        {commercialWindow && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Ventana comercial</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              {commercialWindow.status === "abierta" && "Abierta"}
              {commercialWindow.status === "cerrada" && "Cerrada"}
              {commercialWindow.status === "aun_no_abre" && "Aún no abre"}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {commercialWindow.status === "cerrada"
                ? `Se cerró al iniciar construcción (${fmt(commercialWindow.closesAt)})`
                : `${fmt(commercialWindow.opensAt)} → ${fmt(commercialWindow.closesAt)}`}
            </p>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-neutral-500">
              Tramo estimado entre Compras y Construcción — probable ventana para adjudicar EPC/equipos.
            </p>
          </div>
        )}

        {codOutlook.score !== null && (
          <div className="rounded-lg border border-neutral-100 p-4 dark:border-neutral-900">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Probabilidad de cumplir COD</p>
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
                  <span className="truncate">{step.label}</span>
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
        Estatus, próximo hito, ventana comercial y probabilidad de COD son estimaciones propias derivadas del modelo
        probabilístico de cronograma y del estado de trámite — no son datos oficiales verificados.
      </p>
    </div>
  );
}
