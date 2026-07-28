export function MarketPulseCard({ solicitudes7d, solicitudes30d }: { solicitudes7d: number; solicitudes30d: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-8">
        <div>
          <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
            +{solicitudes7d.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Solicitudes ingresadas, últimos 7 días</p>
        </div>
        <div>
          <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
            +{solicitudes30d.toLocaleString("es-CL")}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Solicitudes ingresadas, últimos 30 días</p>
        </div>
      </div>
      <p className="rounded-lg bg-neutral-50 px-3 py-2 text-[11px] leading-5 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
        Este indicador mide nuevas solicitudes con fecha verificable. Las tendencias de cambios de estado se activarán cuando exista suficiente historial comparable.
      </p>
    </div>
  );
}
