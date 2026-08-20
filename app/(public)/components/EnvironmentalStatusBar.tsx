import {
  INFERENCIA_NOTA,
  resolveEnvironmentalEvidence,
  type EnvironmentalEvidenceInput,
} from "@/lib/shared/environmentalEvidence";

/**
 * "Estado ambiental" de la tabla de proyectos, con la evidencia que lo respalda.
 *
 * La barra es la misma en todos los casos con avance —mismo color, mismo
 * tratamiento— justamente para no castigar visualmente a un proyecto cuya
 * situación ambiental está resuelta pero cuyo expediente todavía no pudimos
 * identificar. Lo que distingue lo verificado de lo inferido no es un color más
 * apagado ni una barra gris: es el asterisco, y el tooltip que lo explica.
 */
export function EnvironmentalStatusBar({
  signals,
  locale = "es",
}: {
  signals: EnvironmentalEvidenceInput;
  locale?: "es" | "en";
}) {
  const estado = resolveEnvironmentalEvidence(signals);
  const en = locale === "en";

  if (estado.evidence === "sinInformacion") {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
  }

  // Expediente cerrado sin aprobación: no lleva barra de avance, porque no hay
  // avance que mostrar — el trámite terminó y lo que importa es el desenlace.
  if (estado.evidence === "expedienteTerminado") {
    return (
      <div className="flex items-center gap-2" title={estado.label ?? undefined}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{estado.label}</span>
      </div>
    );
  }

  const porcentaje = estado.percent;
  const titulo = estado.inferred ? `${estado.label} — ${INFERENCIA_NOTA}` : (estado.label ?? undefined);

  return (
    <div className="w-32" title={titulo}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-brand-primary/15 ring-1 ring-brand-primary/10"
        role="progressbar"
        aria-label={
          en
            ? `Environmental status: ${porcentaje ?? 0}%${estado.inferred ? " (inferred from construction progress)" : ""}`
            : `Estado ambiental: ${porcentaje ?? 0}%${estado.inferred ? " (inferido por avance de obra)" : ""}`
        }
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje ?? 0}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary shadow-[0_0_10px_rgba(56,215,197,0.22)]"
          style={{ width: `${porcentaje ?? 0}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[11px] font-medium tabular-nums text-neutral-500">
        {porcentaje === null ? "—" : `${porcentaje}%`}
        {estado.inferred && (
          <abbr title={INFERENCIA_NOTA} className="ml-0.5 cursor-help font-bold no-underline">
            *
          </abbr>
        )}
      </div>
    </div>
  );
}
