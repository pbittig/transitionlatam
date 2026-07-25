// Diagrama hub-and-spoke: la empresa seleccionada al centro, las empresas
// relacionadas (mismo grupo corporativo del Coordinador) alrededor — ver
// ADR-019 para el origen del dato de agrupación.
const SIZE = 420;
const CENTER = SIZE / 2;
const HUB_RADIUS = 46;
const SPOKE_RADIUS = 34;
const ORBIT = 160;

export function StakeholderMap({ centerLabel, relatedLabels }: { centerLabel: string; relatedLabels: string[] }) {
  const n = relatedLabels.length;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-md" role="img" aria-label={`Empresas relacionadas con ${centerLabel}`}>
      {relatedLabels.map((label, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = CENTER + ORBIT * Math.cos(angle);
        const y = CENTER + ORBIT * Math.sin(angle);
        return <line key={`line-${i}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--muted, #c3c2b7)" strokeWidth={1.5} />;
      })}

      {relatedLabels.map((label, i) => {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        const x = CENTER + ORBIT * Math.cos(angle);
        const y = CENTER + ORBIT * Math.sin(angle);
        return (
          <g key={`node-${i}`}>
            <circle cx={x} cy={y} r={SPOKE_RADIUS} fill="light-dark(#eef2f7, #1f2937)" stroke="light-dark(#2a78d6, #3987e5)" strokeWidth={2} />
            <foreignObject x={x - SPOKE_RADIUS} y={y - SPOKE_RADIUS} width={SPOKE_RADIUS * 2} height={SPOKE_RADIUS * 2}>
              <div className="flex h-full w-full items-center justify-center p-1.5 text-center text-[9px] font-medium leading-tight text-neutral-800 dark:text-neutral-100">
                {label}
              </div>
            </foreignObject>
          </g>
        );
      })}

      <circle cx={CENTER} cy={CENTER} r={HUB_RADIUS} fill="light-dark(#2a78d6, #3987e5)" />
      <foreignObject x={CENTER - HUB_RADIUS} y={CENTER - HUB_RADIUS} width={HUB_RADIUS * 2} height={HUB_RADIUS * 2}>
        <div className="flex h-full w-full items-center justify-center p-2 text-center text-[10px] font-semibold leading-tight text-white">
          {centerLabel}
        </div>
      </foreignObject>
    </svg>
  );
}
