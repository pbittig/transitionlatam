// Tile para índices compuestos de la industria — banda de interpretación con
// color de estado (nunca solo color: siempre va con ícono + etiqueta de texto,
// ver references/palette.md "Status palette" de la skill de dataviz).
const BANDS = [
  { max: 1500, label: "Baja concentración", icon: "●", color: { light: "#0ca30c", dark: "#0ca30c" } },
  { max: 2500, label: "Concentración moderada", icon: "▲", color: { light: "#fab219", dark: "#fab219" } },
  { max: Infinity, label: "Alta concentración", icon: "■", color: { light: "#d03b3b", dark: "#d03b3b" } },
];

export function IndexTile({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  const band = BANDS.find((b) => value <= b.max)!;

  return (
    <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        {Math.round(value).toLocaleString("es-CL")}
      </div>
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ color: `light-dark(${band.color.light}, ${band.color.dark})` }}
      >
        <span aria-hidden="true">{band.icon}</span>
        {band.label}
      </div>
      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
  );
}
