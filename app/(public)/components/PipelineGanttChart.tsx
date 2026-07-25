import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_COLORS } from "@/lib/shared/projectPhaseDurations";

const CONFIDENCE_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

function fmt(d: Date): string {
  return d.toLocaleDateString("es-CL", { month: "short", year: "numeric" });
}

/**
 * Gantt agregado del pipeline — una fila por proyecto, mismo eje de fechas
 * compartido para todos, construido sobre el mismo modelo probabilístico que
 * ya se usa en la ficha individual (computeEstimatedPhase). Se limita a los
 * proyectos ya visibles en la página actual (misma paginación/filtros que la
 * tabla) para no intentar dibujar cientos de filas ilegibles a la vez.
 */
export function PipelineGanttChart({ items, today = new Date() }: { items: ProjectListItem[]; today?: Date }) {
  const rows = items
    .map((project) => {
      const phase = computeEstimatedPhase(
        project.estimatedConnectionDate,
        project.technologyCode,
        project.includesStorage,
        project.capacityMw,
        today,
      );
      if (!phase || phase.milestones.length === 0 || !project.estimatedConnectionDate) return null;
      return { project, phase };
    })
    .filter((r): r is { project: ProjectListItem; phase: NonNullable<ReturnType<typeof computeEstimatedPhase>> } => r !== null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Ningún proyecto de esta página tiene tecnología clasificada y fecha estimada de conexión a la vez, así que no
        se puede estimar su cronograma.
      </p>
    );
  }

  const minTime = Math.min(...rows.map((r) => new Date(r.phase.milestones[0].maxStartDate).getTime()), today.getTime());
  const maxTime = Math.max(...rows.map((r) => new Date(r.project.estimatedConnectionDate!).getTime()), today.getTime());
  const span = maxTime - minTime || 1;
  const pct = (t: number) => ((t - minTime) / span) * 100;
  const todayPct = pct(today.getTime());

  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => minTime + (span * i) / (tickCount - 1));

  const skipped = items.length - rows.length;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="flex items-center gap-3">
          <div className="w-48 shrink-0" />
          <div className="relative h-5 flex-1 text-[10px] text-neutral-400 dark:text-neutral-500">
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute -translate-x-1/2"
                style={{ left: `${(i / (tickCount - 1)) * 100}%` }}
              >
                {fmt(new Date(t))}
              </span>
            ))}
          </div>
        </div>
        {rows.map(({ project, phase }) => {
          const pocTime = new Date(project.estimatedConnectionDate!).getTime();
          const segments = phase.milestones.map((m, i) => {
            const startTime = new Date(m.estimatedStartDate).getTime();
            const endTime = i + 1 < phase.milestones.length ? new Date(phase.milestones[i + 1].estimatedStartDate).getTime() : pocTime;
            return { ...m, startPct: pct(startTime), endPct: pct(endTime) };
          });
          return (
            <div
              key={project.id}
              className="flex items-center gap-3 border-b border-neutral-100 py-2 last:border-0 dark:border-neutral-900"
            >
              <div className="w-48 shrink-0 truncate">
                <Link
                  href={`/proyectos/${project.id}`}
                  className="block truncate text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-50"
                  title={project.name}
                >
                  {project.name}
                </Link>
                <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{phase.groupLabel}</div>
              </div>
              <div className="relative h-4 flex-1 rounded-sm bg-neutral-100 dark:bg-neutral-900">
                {segments.map((s) => (
                  <div
                    key={s.phase}
                    className="absolute top-0 h-4"
                    style={{
                      left: `${s.startPct}%`,
                      width: `${Math.max(s.endPct - s.startPct, 0.4)}%`,
                      backgroundColor: PHASE_COLORS[s.phase],
                      opacity: s.reached ? 1 : 0.35,
                    }}
                    title={`${project.name} — ${s.label}: desde ${fmt(new Date(s.estimatedStartDate))} (confianza ${CONFIDENCE_LABEL[s.confidence]})`}
                  />
                ))}
                <div
                  className="absolute top-0 h-4 w-px"
                  style={{ left: `${todayPct}%`, backgroundColor: "light-dark(#eb6834, #d95926)" }}
                  title="Hoy"
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
        Cada barra reconstruye el cronograma probabilístico del proyecto (mismo modelo que en su ficha) hacia atrás
        desde su fecha estimada de conexión — no es un dato confirmado. La línea naranja marca hoy.
        {skipped > 0
          ? ` ${skipped} proyecto${skipped === 1 ? "" : "s"} de esta página quedaron fuera por no tener tecnología clasificada o fecha estimada.`
          : ""}
      </p>
    </div>
  );
}
