import Link from "next/link";
import type { RecentEvent } from "@/lib/data-access/projects";

const EVENT_LABEL: Record<string, string> = {
  announced: "Nueva solicitud",
  capacity_change: "Cambio de capacidad",
  ownership_change: "Cambio de propiedad",
  developer_change: "Cambio de desarrollador",
  connection_date_change: "Cambio de fecha de conexión",
  construction_date_change: "Cambio de fecha de construcción",
  status_change: "Cambio de estado",
  seia_milestone: "Hito SEIA",
  delay: "Retraso",
  other: "Otro",
};

const EVENT_COLOR: Record<string, string> = {
  announced: "light-dark(#2a78d6, #4a90e2)",
  status_change: "light-dark(#c2822a, #eab308)",
  seia_milestone: "light-dark(#0e9488, #2dd4bf)",
  delay: "light-dark(#c23a2a, #ef4444)",
};

function relativeLabel(occurredAt: string): string {
  const days = Math.floor((Date.now() - new Date(occurredAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  if (days < 30) return `Hace ${days} días`;
  return new Date(occurredAt).toLocaleDateString("es-CL");
}

export function ActivityTimeline({ events }: { events: RecentEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin actividad reciente.</p>;
  }

  const onlyAnnounced = events.every((e) => e.eventType === "announced");

  return (
    <div>
      <ol className="flex flex-col">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-900">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: EVENT_COLOR[e.eventType] ?? "light-dark(#a3a3a3, #737373)" }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{relativeLabel(e.occurredAt)}</span>
              </div>
              <p className="text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">{EVENT_LABEL[e.eventType] ?? e.eventType} · </span>
                <Link href={`/proyectos/${e.projectId}`} className="font-medium text-neutral-900 hover:underline dark:text-neutral-50">
                  {e.projectName}
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ol>
      {onlyAnnounced && (
        <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
          Por ahora solo registramos "nueva solicitud" — cuando tengamos una segunda sincronización del listado con
          diff de estados, este timeline también mostrará cambios de estado y hitos SEIA.
        </p>
      )}
    </div>
  );
}
