// Paleta categórica validada (mismo orden fijo que BarList/BubbleChart — ver
// references/palette.md de la skill de dataviz). El acento vive en la barra
// superior, nunca en el texto del valor (regla "el texto no viste el color de
// la serie").
const ACCENT: Record<string, { light: string; dark: string }> = {
  blue: { light: "#2a78d6", dark: "#3987e5" },
  orange: { light: "#eb6834", dark: "#d95926" },
  aqua: { light: "#1baf7a", dark: "#199e70" },
  yellow: { light: "#eda100", dark: "#c98500" },
};

export function StatCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix?: string;
  accent?: keyof typeof ACCENT;
}) {
  const color = accent ? ACCENT[accent] : null;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      {color && <div className="h-1" style={{ backgroundColor: `light-dark(${color.light}, ${color.dark})` }} />}
      <div className="p-6">
        <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {value}
          {suffix ? <span className="ml-1 text-lg font-normal text-neutral-500 dark:text-neutral-400">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}
