import type { PhaseMilestone } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_COLORS } from "@/lib/shared/projectPhaseDurations";
import type { AppLocale } from "@/lib/i18n";

const CONFIDENCE_LABEL = {
  es: { alta: "Alta", media: "Media", baja: "Baja" },
  en: { alta: "High", media: "Medium", baja: "Low" },
} as const;

const PHASE_EN: Record<string, string> = {
  campana_viento: "Wind measurement campaign", desarrollo: "Development", conceptual: "Conceptual engineering",
  basica: "Basic engineering", detalle: "Detailed engineering", compras: "Procurement",
  construccion: "Construction", comisionamiento: "Commissioning", factibilidad: "Feasibility / connection studies",
  pruebas: "Testing and start-up",
};

function fmt(date: Date, locale: AppLocale, withYear = true) {
  return date.toLocaleDateString(locale === "en" ? "en-GB" : "es-CL", {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export interface PgpTimelineMilestone {
  label: string;
  date: string;
}

export function PhaseTimeline({
  milestones,
  connectionDate,
  pgpMilestones = [],
  constructionProgress,
  today = new Date(),
  locale = "es",
}: {
  milestones: PhaseMilestone[];
  connectionDate: string;
  pgpMilestones?: PgpTimelineMilestone[];
  /** Theoretical vs PGP-observed physical progress, shown only on the "construcción" row. */
  constructionProgress?: { theoreticalPercent: number; realPercent: number };
  today?: Date;
  locale?: AppLocale;
}) {
  const poc = new Date(connectionDate);
  const likelyStarts = milestones.map((milestone) => new Date(milestone.estimatedStartDate));
  const pgpDates = pgpMilestones.map((milestone) => new Date(milestone.date));
  const minDate = new Date(Math.min(...milestones.map((milestone) => new Date(milestone.maxStartDate).getTime())));
  const maxDate = new Date(Math.max(poc.getTime(), ...pgpDates.map((date) => date.getTime())));
  const span = Math.max(maxDate.getTime() - minDate.getTime(), 1);
  const pct = (date: Date) => Math.min(100, Math.max(0, ((date.getTime() - minDate.getTime()) / span) * 100));
  const todayPct = pct(today);
  const todayInRange = today >= minDate && today <= maxDate;
  const midpoint = new Date(minDate.getTime() + span / 2);

  const rows = milestones.map((milestone, index) => {
    const start = likelyStarts[index];
    const finish = likelyStarts[index + 1] ?? poc;
    const current = today >= start && today < finish;
    const completed = today >= finish;
    return { milestone, start, finish, current, completed };
  });

  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[180px_minmax(480px,1fr)] gap-x-4 border-b border-neutral-200 pb-2 text-[11px] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
          <span>{locale === "en" ? "Theoretical phase" : "Etapa teórica"}</span>
          <div className="flex justify-between">
            <span>{fmt(minDate, locale)}</span>
            <span>{fmt(midpoint, locale)}</span>
            <span>{locale === "en" ? "Connection" : "Conexión"} · {fmt(poc, locale)}</span>
          </div>
        </div>

        <div className="relative mt-2">
          {todayInRange && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-[#eb6834]"
              style={{ left: `calc(196px + (100% - 196px) * ${todayPct / 100})` }}
              aria-hidden="true"
            >
              <span className="absolute -top-1 -translate-x-1/2 -translate-y-full bg-white px-1 text-[10px] font-semibold text-[#d95926] dark:bg-neutral-950">
                {locale === "en" ? "Today" : "Hoy"}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {rows.map(({ milestone, start, finish, current, completed }) => {
              const left = pct(start);
              const width = Math.max(pct(finish) - left, 0.8);
              const uncertaintyLeft = pct(new Date(milestone.maxStartDate));
              const uncertaintyWidth = Math.max(pct(new Date(milestone.minStartDate)) - uncertaintyLeft, 0.5);
              const phaseLabel = locale === "en" ? PHASE_EN[milestone.phase] : milestone.label;
              const status = current
                ? locale === "en" ? "Current estimate" : "Estimación actual"
                : completed
                  ? locale === "en" ? "Completed period" : "Período cumplido"
                  : locale === "en" ? "Upcoming" : "Próxima";

              return (
                <div
                  key={milestone.phase}
                  className={`grid min-h-14 grid-cols-[180px_minmax(480px,1fr)] items-center gap-x-4 rounded-md px-2 ${current ? "bg-brand-surface/70 ring-1 ring-brand-primary/25 dark:bg-brand-primary/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-900/60"}`}
                >
                  <div className="min-w-0 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: PHASE_COLORS[milestone.phase] }} />
                      <span className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-100">{phaseLabel}</span>
                    </div>
                    <p className={`mt-1 pl-4 text-[10px] ${current ? "font-semibold text-brand-deep dark:text-brand-primary" : "text-neutral-400"}`}>
                      {status} · {locale === "en" ? "Confidence" : "Confianza"} {CONFIDENCE_LABEL[locale][milestone.confidence].toLowerCase()}
                    </p>
                    {milestone.phase === "construccion" && constructionProgress && (
                      <p className="mt-1 pl-4 text-[10px]">
                        <span className="font-medium text-neutral-500 dark:text-neutral-400">
                          {locale === "en" ? "Theoretical" : "Teórico"} {constructionProgress.theoreticalPercent}%
                        </span>
                        {" · "}
                        <span
                          className={`font-semibold ${
                            constructionProgress.realPercent < constructionProgress.theoreticalPercent - 10
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-emerald-700 dark:text-emerald-400"
                          }`}
                        >
                          {locale === "en" ? "Actual (PGP)" : "Real (PGP)"} {constructionProgress.realPercent}%
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="relative h-9 border-x border-neutral-100 dark:border-neutral-800">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent_24.8%,rgba(163,163,163,.15)_25%,transparent_25.2%,transparent_49.8%,rgba(163,163,163,.15)_50%,transparent_50.2%,transparent_74.8%,rgba(163,163,163,.15)_75%,transparent_75.2%)]" aria-hidden="true" />
                    <div
                      className="absolute top-2 h-5 rounded-sm"
                      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: PHASE_COLORS[milestone.phase], opacity: completed ? 0.55 : current ? 1 : 0.3 }}
                      title={`${phaseLabel}: ${fmt(start, locale)} – ${fmt(finish, locale)}`}
                    />
                    <div
                      className="absolute top-2 h-5 rounded-sm"
                      style={{
                        left: `${uncertaintyLeft}%`,
                        width: `${uncertaintyWidth}%`,
                        backgroundImage: "repeating-linear-gradient(45deg, rgba(38,38,38,.32) 0 3px, transparent 3px 7px)",
                      }}
                      title={`${locale === "en" ? "Start range" : "Rango de inicio"}: ${fmt(new Date(milestone.maxStartDate), locale)} – ${fmt(new Date(milestone.minStartDate), locale)}`}
                    />
                    <span className="absolute top-7 text-[9px] text-neutral-400" style={{ left: `${left}%` }}>
                      {fmt(start, locale, false)}
                    </span>
                  </div>
                </div>
              );
            })}

            {pgpMilestones.map((milestone, index) => {
              const date = pgpDates[index];
              const left = pct(date);
              return (
                <div
                  key={`pgp-${milestone.label}`}
                  className="grid min-h-14 grid-cols-[180px_minmax(480px,1fr)] items-center gap-x-4 rounded-md px-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                >
                  <div className="min-w-0 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 shrink-0 rotate-45 bg-neutral-700 dark:bg-neutral-300" />
                      <span className="truncate text-xs font-semibold text-neutral-800 dark:text-neutral-100">{milestone.label}</span>
                    </div>
                    <p className="mt-1 pl-4 text-[10px] text-neutral-400">
                      {locale === "en" ? "Confirmed by PGP" : "Confirmado por PGP"}
                    </p>
                  </div>

                  <div className="relative h-9 border-x border-neutral-100 dark:border-neutral-800">
                    <div
                      className="absolute top-3.5 size-2.5 -translate-x-1/2 rotate-45 bg-neutral-700 dark:bg-neutral-300"
                      style={{ left: `${left}%` }}
                      title={`${milestone.label}: ${fmt(date, locale)}`}
                    />
                    <span className="absolute top-7 -translate-x-1/2 text-[9px] text-neutral-400" style={{ left: `${left}%` }}>
                      {fmt(date, locale, false)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-3 text-[10px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-neutral-400/40" />{locale === "en" ? "Estimated duration" : "Duración estimada"}</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 bg-[repeating-linear-gradient(45deg,rgba(38,38,38,.3)_0_3px,transparent_3px_7px)]" />{locale === "en" ? "Start uncertainty" : "Incertidumbre de inicio"}</span>
          {pgpMilestones.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rotate-45 bg-neutral-700 dark:bg-neutral-300" />
              {locale === "en" ? "Milestone confirmed by the Coordinador (PGP)" : "Hito confirmado por el Coordinador (PGP)"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
