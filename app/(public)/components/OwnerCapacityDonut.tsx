const COLORS = ["#0f766e", "#14b8a6", "#2563eb", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b", "#cbd5e1"];

export function OwnerCapacityDonut({
  owners,
  totalCapacityMw,
}: {
  owners: Array<{ owner: string; capacityMw: number; plantCount: number }>;
  totalCapacityMw: number;
}) {
  const principal = owners.slice(0, 7);
  const principalMw = principal.reduce((sum, owner) => sum + owner.capacityMw, 0);
  const items = [
    ...principal,
    ...(totalCapacityMw > principalMw
      ? [{ owner: "Otros propietarios", capacityMw: totalCapacityMw - principalMw, plantCount: 0 }]
      : []),
  ].filter((owner) => owner.capacityMw > 0);
  const circumference = 2 * Math.PI * 42;
  let accumulated = 0;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[210px_1fr]">
      <div className="relative mx-auto size-52">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Participación de capacidad por propietario">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="14" className="text-neutral-100 dark:text-neutral-800" />
          {items.map((item, index) => {
            const fraction = item.capacityMw / totalCapacityMw;
            const length = fraction * circumference;
            const offset = -accumulated * circumference;
            accumulated += fraction;
            return (
              <circle
                key={item.owner}
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={COLORS[index % COLORS.length]}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-semibold text-neutral-950 dark:text-white">
            {(totalCapacityMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}
          </span>
          <span className="text-xs text-neutral-500">GW operativos</span>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {items.map((item, index) => {
          const share = totalCapacityMw > 0 ? (item.capacityMw / totalCapacityMw) * 100 : 0;
          return (
            <li key={item.owner} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="truncate text-neutral-600 dark:text-neutral-300" title={item.owner}>{item.owner}</span>
              <span className="font-medium tabular-nums text-neutral-900 dark:text-white">{share.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
