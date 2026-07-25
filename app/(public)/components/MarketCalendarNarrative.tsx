import type { MarketCalendarHighlight } from "@/lib/shared/marketSnapshot";

export function MarketCalendarNarrative({ highlights }: { highlights: MarketCalendarHighlight[] }) {
  if (highlights.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin hitos estimables en el rango.</p>;
  }
  return (
    <ol className="flex flex-col">
      {highlights.map((h, i) => (
        <li key={i} className="flex items-baseline gap-4 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-900">
          <span className="w-16 shrink-0 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{h.quarter}</span>
          <span className="text-sm text-neutral-700 dark:text-neutral-300">{h.description}</span>
        </li>
      ))}
    </ol>
  );
}
