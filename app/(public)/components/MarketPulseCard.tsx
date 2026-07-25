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
      <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
        Por ahora solo podemos medir "solicitudes nuevas" con fecha real (ver Actividad reciente). Cambios de estado,
        aprobaciones de RCA y MW conectados en una ventana de tiempo requieren una segunda sincronización del listado
        con diff de estados — todavía no la tenemos (solo un snapshot). Los agregaremos aquí cuando esté disponible.
      </p>
    </div>
  );
}
