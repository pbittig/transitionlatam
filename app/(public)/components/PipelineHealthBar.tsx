import type { PipelineHealthDistribution } from "@/lib/shared/marketSnapshot";
import { lightDark, STATUS_COLORS } from "@/lib/shared/chartColors";

const ALTA_COLOR = lightDark(STATUS_COLORS.alta);
const MEDIA_COLOR = lightDark(STATUS_COLORS.media);
const BAJA_COLOR = lightDark(STATUS_COLORS.baja);

export function PipelineHealthBar({ health }: { health: PipelineHealthDistribution }) {
  if (health.total === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos con Health Score calculable.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {health.total.toLocaleString("es-CL")} proyectos vigentes con "Probabilidad de cumplir COD" calculada.
      </p>
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        <div style={{ width: `${health.altaPct}%`, backgroundColor: ALTA_COLOR }} title={`Alta: ${health.alta}`} />
        <div style={{ width: `${health.mediaPct}%`, backgroundColor: MEDIA_COLOR }} title={`Media: ${health.media}`} />
        <div style={{ width: `${health.bajaPct}%`, backgroundColor: BAJA_COLOR }} title={`Baja: ${health.baja}`} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ALTA_COLOR }} />
          <strong className="text-neutral-900 dark:text-neutral-50">{health.altaPct}%</strong>
          <span className="text-neutral-500 dark:text-neutral-400">en desarrollo normal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: MEDIA_COLOR }} />
          <strong className="text-neutral-900 dark:text-neutral-50">{health.mediaPct}%</strong>
          <span className="text-neutral-500 dark:text-neutral-400">con riesgo medio</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAJA_COLOR }} />
          <strong className="text-neutral-900 dark:text-neutral-50">{health.bajaPct}%</strong>
          <span className="text-neutral-500 dark:text-neutral-400">con riesgo alto</span>
        </span>
      </div>
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
        Bandas de "Probabilidad de cumplir COD" (mismo cálculo que en cada ficha) agregadas sobre todo el pipeline
        vigente — estimación propia, no un dato oficial.
      </p>
    </div>
  );
}
