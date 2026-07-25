export function MarketSnapshotList({ insights }: { insights: string[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin datos suficientes todavía para generar conclusiones.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {insights.map((text, i) => (
        <li key={i} className="border-l-2 border-neutral-200 py-1 pl-4 text-neutral-800 dark:border-neutral-800 dark:text-neutral-200">
          {text}
        </li>
      ))}
    </ul>
  );
}
