import { getStatusMaturity, isRejectedStatus, STATUS_BAND_LABEL } from "@/lib/shared/projectStatusMaturity";

// Gradiente "frío → caliente" (azul → ámbar → rojo) — el mismo concepto de rampa
// secuencial de la skill de dataviz, aplicado como termómetro literal en vez de
// una sola tonalidad, porque es la metáfora pedida (temperatura del proceso).
const THERMAL_GRADIENT = "linear-gradient(90deg, #2a78d6 0%, #1baf7a 35%, #eda100 65%, #e34948 100%)";

export function ThermalStatusBar({ status, compact = false }: { status: string | null; compact?: boolean }) {
  if (!status) {
    return <span className="text-sm text-neutral-400 dark:text-neutral-500">—</span>;
  }

  if (isRejectedStatus(status)) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
        <span className="text-sm text-neutral-500 dark:text-neutral-400">{status}</span>
      </div>
    );
  }

  const maturity = getStatusMaturity(status);
  if (!maturity) {
    return <span className="text-sm text-neutral-600 dark:text-neutral-400">{status}</span>;
  }

  return (
    <div className={compact ? "w-32" : "w-full max-w-sm"}>
      <div className="relative h-1.5 rounded-full" style={{ background: THERMAL_GRADIENT }}>
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow dark:border-neutral-900"
          style={{ left: `${maturity.order}%`, backgroundColor: "#0b0b0b" }}
          title={status}
        />
      </div>
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between text-xs">
          <span className="text-neutral-500 dark:text-neutral-400">{STATUS_BAND_LABEL[maturity.band]}</span>
          <span className="text-neutral-400 dark:text-neutral-500">{maturity.order}%</span>
        </div>
      )}
    </div>
  );
}
