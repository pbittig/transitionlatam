import type { PhaseMilestone } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_COLORS } from "@/lib/shared/projectPhaseDurations";

const CONFIDENCE_LABEL: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };

function fmt(d: Date): string {
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

export function PhaseTimeline({
  milestones,
  connectionDate,
  today = new Date(),
}: {
  milestones: PhaseMilestone[];
  connectionDate: string;
  today?: Date;
}) {
  const poc = new Date(connectionDate);

  // Los offsets ya vienen no decrecientes por construcción (se acumulan desde
  // el COD hacia atrás en computeEstimatedPhase.ts) — no hace falta forzarlos
  // acá como en el modelo anterior.
  const likelyStarts = milestones.map((m) => new Date(m.estimatedStartDate));
  const maxStarts = milestones.map((m) => new Date(m.maxStartDate)); // escenario lento = fecha más temprana

  const minDate = maxStarts[0] ?? likelyStarts[0];
  const end = poc;
  const span = end.getTime() - minDate.getTime() || 1;
  const pct = (d: Date) => ((d.getTime() - minDate.getTime()) / span) * 100;

  const segments = milestones.map((m, i) => ({
    ...m,
    start: likelyStarts[i],
    finish: i + 1 < likelyStarts.length ? likelyStarts[i + 1] : end,
  }));

  const todayPct = Math.min(Math.max(pct(today), 0), 100);
  const pocPct = pct(poc);

  return (
    <div className="mb-6">
      <div className="relative h-16">
        {/* Barras de etapa, conectadas de extremo a extremo, un color por etapa */}
        <div className="absolute top-6 flex h-7 w-full overflow-hidden rounded-md">
          {segments.map((s, i) => {
            const width = Math.max(pct(s.finish) - pct(s.start), 0.5);
            return (
              <div
                key={s.phase}
                className={i > 0 ? "border-l border-white dark:border-neutral-900" : ""}
                style={{
                  width: `${width}%`,
                  backgroundColor: PHASE_COLORS[s.phase],
                  opacity: s.reached ? 1 : 0.3,
                }}
                title={`${s.label} — desde ${fmt(s.start)} (rango: ${fmt(new Date(s.maxStartDate))} a ${fmt(new Date(s.minStartDate))} · confianza ${CONFIDENCE_LABEL[s.confidence]})`}
              />
            );
          })}
        </div>
        {/* Banda de incertidumbre propia de cada etapa (rango min-max real, no un ±fijo) */}
        {milestones.map((m) => {
          const left = pct(new Date(m.maxStartDate));
          const width = Math.max(pct(new Date(m.minStartDate)) - left, 0.5);
          return (
            <div
              key={`band-${m.phase}`}
              className="absolute top-6 h-7"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, light-dark(rgba(38,38,38,.3), rgba(255,255,255,.25)) 0 3px, transparent 3px 7px)",
              }}
              title={`${m.label}: rango ${fmt(new Date(m.maxStartDate))} a ${fmt(new Date(m.minStartDate))}`}
            />
          );
        })}
        {/* Marcador de hoy */}
        <div className="absolute top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `${todayPct}%` }}>
          <span className="text-[10px] font-semibold" style={{ color: "light-dark(#eb6834, #d95926)" }}>
            Hoy
          </span>
        </div>
        <div
          className="absolute top-6 h-7 w-0.5"
          style={{ left: `${todayPct}%`, backgroundColor: "light-dark(#eb6834, #d95926)" }}
        />
        {/* Marcador de POC */}
        <div className="absolute top-1 flex -translate-x-1/2 flex-col items-center" style={{ left: `${pocPct}%` }}>
          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">POC</span>
        </div>
        <div
          className="absolute top-6 h-7 w-0.5 bg-neutral-500 dark:bg-neutral-400"
          style={{ left: `${pocPct}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {milestones.map((m) => (
          <span
            key={m.phase}
            className={`flex items-center gap-1.5 ${
              m.reached ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-400 dark:text-neutral-600"
            }`}
          >
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: PHASE_COLORS[m.phase], opacity: m.reached ? 1 : 0.4 }}
            />
            {m.label} · {fmt(new Date(m.estimatedStartDate))}
            <span className="text-neutral-400 dark:text-neutral-600">({CONFIDENCE_LABEL[m.confidence]})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
