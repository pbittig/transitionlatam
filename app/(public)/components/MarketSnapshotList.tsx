export function MarketSnapshotList({ insights }: { insights: string[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin datos suficientes todavía para generar conclusiones.</p>;
  }
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {insights.map((text, i) => (
        <li key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-surface text-xs font-semibold text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary">
            {i + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}
