"use client";

// Gráfico de burbujas Cantidad de centrales × Capacidad promedio por central,
// con tamaño = capacidad total y color = tecnología dominante — cruce de 4
// variables en una sola vista (ver skill de dataviz, forma "bubble", cap de
// 3 series categóricas + "Otras" para formas all-pairs).
import { useState } from "react";
import { OTHER_COLOR } from "@/lib/shared/chartColors";

export interface BubblePoint {
  region: string;
  capacityMw: number;
  plantCount: number;
  dominantTechnology: string;
}

// Paleta categórica validada (orden fijo, primeros 3 slots — ver references/palette.md de la
// skill de dataviz: blue, orange, aqua son los únicos 3 que pasan el chequeo all-pairs en
// ambos modos). A propósito NO son los mismos hex que TECH_COLORS de chartColors.ts (que
// mapea Solar/Eólico/Hidro a amarillo/verde/aqua por significado de marca): ese mapeo solo
// vale para gráficos de barras/stacks (pares *adyacentes*), no para un scatter/bubble donde
// cualquier par de puntos puede quedar lado a lado — ahí manda la cota de 3 series de la skill.
const TECH_COLOR: Record<string, { light: string; dark: string }> = {
  Solares: { light: "#2a78d6", dark: "#3987e5" },
  Hidroeléctricas: { light: "#eb6834", dark: "#d95926" },
  Eólicas: { light: "#1baf7a", dark: "#199e70" },
};

const WIDTH = 760;
const HEIGHT = 440;
const MARGIN = { top: 20, right: 24, bottom: 48, left: 56 };
const MIN_RADIUS = 10;
const MAX_RADIUS = 46;

function colorFor(tech: string): { light: string; dark: string } {
  return TECH_COLOR[tech] ?? OTHER_COLOR;
}

export function BubbleChart({ points }: { points: BubblePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const withAvg = points.map((p) => ({ ...p, avgMw: p.capacityMw / p.plantCount }));
  const maxCount = Math.max(...withAvg.map((p) => p.plantCount));
  const maxAvg = Math.max(...withAvg.map((p) => p.avgMw));
  const maxCapacitySqrt = Math.sqrt(Math.max(...withAvg.map((p) => p.capacityMw)));
  const minCapacitySqrt = Math.sqrt(Math.min(...withAvg.map((p) => p.capacityMw)));

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const x = (count: number) => MARGIN.left + (count / maxCount) * plotW;
  const y = (avg: number) => MARGIN.top + plotH - (avg / maxAvg) * plotH;
  const r = (capacityMw: number) => {
    const t = (Math.sqrt(capacityMw) - minCapacitySqrt) / (maxCapacitySqrt - minCapacitySqrt || 1);
    return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
  };

  // Etiquetar solo las mayores por capacidad total — nunca un número en cada punto.
  const topByCapacity = [...withAvg].sort((a, b) => b.capacityMw - a.capacityMw).slice(0, 4).map((p) => p.region);

  const legendTechs = ["Solares", "Hidroeléctricas", "Eólicas", "Otras"];
  const hasOther = withAvg.some((p) => !TECH_COLOR[p.dominantTechnology]);

  return (
    <div className="viz-root">
      <style>{`
        /* Grises de marca (Manual de Marca Web §5): #2F3136 oscuro, #6B7280 medio, #E5E7EB claro, #F7F8FA fondo alternativo. */
        .viz-root { color-scheme: light; }
        .viz-root { --text-primary: #2f3136; --text-secondary: #6b7280; --muted: #6b7280; --grid: #e5e7eb; --surface: #f7f8fa; }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root { --text-primary: #ededed; --text-secondary: #9ca3af; --muted: #9ca3af; --grid: #262626; --surface: #141414; }
        }
        :root[data-theme="dark"] .viz-root { --text-primary: #ededed; --text-secondary: #9ca3af; --muted: #9ca3af; --grid: #262626; --surface: #141414; }
        .viz-root .bubble { transition: opacity 120ms ease; }
      `}</style>

      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {legendTechs
          .filter((t) => t !== "Otras" || hasOther)
          .map((t) => {
            const color = t === "Otras" ? OTHER_COLOR : colorFor(t);
            return (
              <span key={t} className="flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: `light-dark(${color.light}, ${color.dark})` }}
                />
                {t}
              </span>
            );
          })}
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Centrales por región: cantidad, capacidad promedio y tecnología dominante">
        {/* Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={MARGIN.top + plotH * t}
            y2={MARGIN.top + plotH * t}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        {/* Axes */}
        <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--muted)" strokeWidth={1} />
        <line
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={MARGIN.top + plotH}
          y2={MARGIN.top + plotH}
          stroke="var(--muted)"
          strokeWidth={1}
        />
        <text x={MARGIN.left + plotW / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
          Cantidad de centrales
        </text>
        <text
          x={14}
          y={MARGIN.top + plotH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted)"
          transform={`rotate(-90, 14, ${MARGIN.top + plotH / 2})`}
        >
          Capacidad promedio por central (MW)
        </text>

        {/* Bubbles */}
        {withAvg.map((p, i) => {
          const color = colorFor(p.dominantTechnology);
          const isHovered = hovered === i;
          return (
            <g key={p.region}>
              <circle
                className="bubble"
                cx={x(p.plantCount)}
                cy={y(p.avgMw)}
                r={r(p.capacityMw)}
                fill={`light-dark(${color.light}, ${color.dark})`}
                fillOpacity={isHovered ? 0.95 : 0.75}
                stroke="var(--surface)"
                strokeWidth={2}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {topByCapacity.includes(p.region) && (
                <text
                  x={x(p.plantCount)}
                  y={y(p.avgMw) - r(p.capacityMw) - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--text-secondary)"
                >
                  {p.region}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div
          className="mt-2 rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: "var(--grid)", color: "var(--text-primary)" }}
        >
          <strong>{withAvg[hovered].region}</strong> — {Math.round(withAvg[hovered].capacityMw).toLocaleString("es-CL")} MW ·{" "}
          {withAvg[hovered].plantCount} centrales · {Math.round(withAvg[hovered].avgMw)} MW promedio ·{" "}
          {withAvg[hovered].dominantTechnology} (dominante)
        </div>
      )}
    </div>
  );
}
