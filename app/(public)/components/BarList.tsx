// Barra horizontal simple (magnitud) — paleta y especificación de marcas según
// la skill de dataviz del proyecto: barras finas, extremos redondeados,
// etiqueta directa con el valor, sin más de ~8 categorías (el resto se pliega
// en "Otros" antes de llegar aquí). Colores centralizados en lib/shared/chartColors.ts
// (Manual de Marca Web §10 + paleta validada de la skill).
import { GENERIC_CATEGORICAL, lightDark, PRINCIPAL_COLOR, techColor } from "@/lib/shared/chartColors";

export interface BarListItem {
  label: string;
  value: number;
  secondaryValue?: string;
  /** Categoría canónica (ver MARKET_TECH_CATEGORIES) para colorear por significado de marca en vez de por posición. */
  techCategory?: string;
}

export function BarList({ items, categorical = false }: { items: BarListItem[]; categorical?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => {
        const widthPct = Math.max((item.value / max) * 100, 3);
        const color = item.techCategory
          ? techColor(item.techCategory)
          : categorical
            ? GENERIC_CATEGORICAL[i % GENERIC_CATEGORICAL.length]
            : PRINCIPAL_COLOR;
        return (
          <li key={item.label} title={`${item.label}: ${item.value.toLocaleString("es-CL")}${item.secondaryValue ? ` · ${item.secondaryValue}` : ""}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-neutral-700 dark:text-neutral-300">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-neutral-900 dark:text-neutral-50">
                {item.value.toLocaleString("es-CL")}
                {item.secondaryValue ? (
                  <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">{item.secondaryValue}</span>
                ) : null}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800">
              <div className="h-2 rounded-full" style={{ width: `${widthPct}%`, backgroundColor: lightDark(color) }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
