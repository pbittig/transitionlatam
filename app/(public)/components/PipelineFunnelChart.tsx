import type { PipelineFunnel } from "@/lib/data-access/pipeline";
import { lightDark, PRINCIPAL_COLOR } from "@/lib/shared/chartColors";

export function PipelineFunnelChart({ funnel }: { funnel: PipelineFunnel }) {
  const stages = [
    { label: "Solicitudes ingresadas", value: funnel.total },
    { label: "Vigentes (no rechazadas/desistidas)", value: funnel.noRechazado },
    { label: "Con expediente SEIA asociado", value: funnel.conSeia },
    { label: "Con RCA aprobada", value: funnel.conRca },
    { label: "En etapa avanzada", value: funnel.etapaAvanzada },
    { label: "Declarado en construcción", value: funnel.declaradoConstruccion },
  ];
  const max = stages[0].value || 1;

  return (
    <ul className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const widthPct = Math.max((s.value / max) * 100, 2);
        const pctOfTotal = max > 0 ? (s.value / max) * 100 : 0;
        return (
          <li key={i}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">{s.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                {s.value.toLocaleString("es-CL")}
                <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">
                  ({pctOfTotal.toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-2.5 rounded-full"
                style={{ width: `${widthPct}%`, backgroundColor: lightDark(PRINCIPAL_COLOR), opacity: 1 - i * 0.12 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
