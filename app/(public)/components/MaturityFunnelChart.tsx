import type { MaturityFunnel } from "@/lib/shared/maturityFunnel";
import { lightDark, PRINCIPAL_COLOR } from "@/lib/shared/chartColors";

export function MaturityFunnelChart({ funnel }: { funnel: MaturityFunnel }) {
  if (funnel.total === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos con cronograma estimable.</p>;
  }
  const max = funnel.total;

  return (
    <ul className="flex flex-col gap-3">
      <li>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
          <span className="text-neutral-700 dark:text-neutral-300">Vigentes con cronograma estimable</span>
          <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
            {funnel.total.toLocaleString("es-CL")} <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">(100%)</span>
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div className="h-2.5 rounded-full" style={{ width: "100%", backgroundColor: lightDark(PRINCIPAL_COLOR) }} />
        </div>
      </li>
      {funnel.stages.map((s, i) => {
        const widthPct = Math.max((s.count / max) * 100, 2);
        const pctOfTotal = max > 0 ? (s.count / max) * 100 : 0;
        return (
          <li key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="text-neutral-700 dark:text-neutral-300">{s.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                {s.count.toLocaleString("es-CL")}
                <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">({pctOfTotal.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: lightDark(PRINCIPAL_COLOR),
                  opacity: 1 - (i + 1) * 0.12,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
