import type { SignupDay } from "@/lib/data-access/adminMetrics";

const WIDTH = 720;
const HEIGHT = 200;
const PAD_LEFT = 32;
const PAD_BOTTOM = 24;
const PAD_TOP = 16;

/** Fills in any missing days (no signups that day = 0) so the line reads as continuous time, not just the days with data. */
function fillLast30Days(signupsByDay: SignupDay[]): SignupDay[] {
  const byDay = new Map(signupsByDay.map((d) => [d.day, d.count]));
  const days: SignupDay[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return days;
}

export function SignupsLineChart({ signupsByDay, locale = "es" }: { signupsByDay: SignupDay[]; locale?: "es" | "en" }) {
  const days = fillLast30Days(signupsByDay);
  const max = Math.max(1, ...days.map((d) => d.count));
  const plotWidth = WIDTH - PAD_LEFT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = plotWidth / (days.length - 1);
  const yFor = (count: number) => PAD_TOP + plotHeight - (count / max) * plotHeight;
  const points = days.map((d, i) => [PAD_LEFT + i * stepX, yFor(d.count)] as const);
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} L${points[0][0].toFixed(1)},${(PAD_TOP + plotHeight).toFixed(1)} Z`;
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const gridLines = [0, Math.ceil(max / 2), max];

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === "en" ? "en-GB" : "es-CL", { day: "2-digit", month: "short" });

  return (
    <div>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {locale === "en" ? `${total} signups in the last 30 days` : `${total} registros en los últimos 30 días`}
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-2 w-full" role="img" aria-label={locale === "en" ? "Signups per day, last 30 days" : "Registros por día, últimos 30 días"}>
        {gridLines.map((value) => (
          <g key={value}>
            <line x1={PAD_LEFT} x2={WIDTH} y1={yFor(value)} y2={yFor(value)} className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth={1} />
            <text x={0} y={yFor(value) + 3} className="fill-neutral-400 text-[9px] dark:fill-neutral-500">
              {value}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="#38d7c5" fillOpacity={0.12} />
        <path d={linePath} fill="none" stroke="#38d7c5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) =>
          days[i].count > 0 ? <circle key={i} cx={x} cy={y} r={2.5} fill="#38d7c5" /> : null,
        )}
        <text x={PAD_LEFT} y={HEIGHT - 4} className="fill-neutral-400 text-[9px] dark:fill-neutral-500">
          {fmt(days[0].day)}
        </text>
        <text x={WIDTH} y={HEIGHT - 4} textAnchor="end" className="fill-neutral-400 text-[9px] dark:fill-neutral-500">
          {fmt(days[days.length - 1].day)}
        </text>
      </svg>
    </div>
  );
}
