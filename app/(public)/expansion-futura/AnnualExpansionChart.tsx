"use client";

import { useState } from "react";
import { lightDark, techColor } from "@/lib/shared/chartColors";
import type { AppLocale } from "@/lib/i18n";

/**
 * Expansión por año y tecnología. Barras apiladas porque cada año es un todo
 * repartido entre tecnologías; una línea por tecnología escondería el total
 * anual, que es la lectura principal.
 *
 * Especificación de marcas de la skill de dataviz: barras finas, extremos
 * redondeados de 4px solo en el segmento superior, separación de 2px del color
 * de superficie entre segmentos apilados, ejes recesivos, leyenda siempre
 * presente (son dos o más series) y valores en tinta, nunca en el color de la
 * serie.
 */
export function AnnualExpansionChart({
  data,
  techs,
  locale,
  cumulative = false,
}: {
  data: Array<{ year: number; byTech: Record<string, number> }>;
  techs: Array<{ code: string; label: string; category: string; color?: string }>;
  locale: AppLocale;
  cumulative?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const totals = data.map((d) => techs.reduce((s, t) => s + (d.byTech[t.code] ?? 0), 0));
  const max = Math.max(...totals, 1);
  const loc = locale === "en" ? "en-US" : "es-CL";
  /** La etiqueta sobre la barra va en GW entero, como la visualización oficial. */
  const gwLabel = (mw: number) => Math.round(mw / 1000).toLocaleString(loc);
  /** El tooltip va en MW con dos decimales: en MW el decimal sí distingue activos. */
  const mwFmt = (mw: number) =>
    `${mw.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW`;
  const colorOf = (t: { category: string; color?: string }) => t.color ?? lightDark(techColor(t.category));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {techs.map((t) => (
          <span key={t.code} className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(t) }} />
            {t.label}
          </span>
        ))}
      </div>

      <div
        className="relative flex h-56 items-end gap-[2px]"
        role="img"
        aria-label={locale === "en" ? "Expansion by year and technology" : "Expansión por año y tecnología"}
      >
        {data.map((d, i) => {
          const total = totals[i];
          const heightPct = Math.max((total / max) * 100, 0.5);
          const segments = techs.filter((t) => (d.byTech[t.code] ?? 0) > 0);
          return (
            <div
              key={d.year}
              className="group relative flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(d.year)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Etiqueta directa del total. En tinta, nunca en el color de la serie. */}
              <span className="mb-0.5 text-center text-[9px] font-medium leading-none text-neutral-500 dark:text-neutral-400">
                {gwLabel(total)}
              </span>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-[4px]" style={{ height: `${heightPct}%` }}>
                {segments.map((t, si) => (
                  <div
                    key={t.code}
                    style={{
                      height: `${((d.byTech[t.code] ?? 0) / total) * 100}%`,
                      backgroundColor: colorOf(t),
                      // 2px de superficie entre segmentos: separa sin agregar un borde de color.
                      marginTop: si === 0 ? 0 : 2,
                    }}
                  />
                ))}
              </div>
              {hover === d.year && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-md border border-neutral-200 bg-white p-2 text-[11px] shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="font-semibold text-neutral-900 dark:text-neutral-50">{d.year}</p>
                  {segments.map((t) => (
                    <p key={t.code} className="flex items-center justify-between gap-2 text-neutral-600 dark:text-neutral-400">
                      <span className="flex items-center gap-1 truncate">
                        <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: colorOf(t) }} />
                        {t.label}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-100">
                        {mwFmt(d.byTech[t.code] ?? 0)}
                      </span>
                    </p>
                  ))}
                  <p className="mt-1 flex justify-between border-t border-neutral-100 pt-1 font-semibold text-neutral-900 dark:border-neutral-800 dark:text-neutral-50">
                    <span>{cumulative ? (locale === "en" ? "Cumulative" : "Acumulado") : "Total"}</span>
                    <span className="tabular-nums">{mwFmt(total)}</span>
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
        <span>{data[0]?.year}</span>
        <span>{data[Math.floor(data.length / 2)]?.year}</span>
        <span>{data[data.length - 1]?.year}</span>
      </div>
    </div>
  );
}
