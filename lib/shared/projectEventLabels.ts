import type { AppLocale } from "@/lib/i18n";

/**
 * Nombre legible de cada tipo de evento de proyecto.
 *
 * `project_event.event_type` guarda la clave técnica en inglés
 * ("connection_date_change"). Mostrarla tal cual —aunque sea con los guiones
 * bajos cambiados por espacios— deja "connection date change" en medio de una
 * tabla en español, que fue justamente lo que apareció en el reporte diario por
 * correo. Esta es la única traducción: la pantalla de Seguimiento y el correo
 * la comparten para que no vuelvan a divergir.
 */
export const PROJECT_EVENT_LABELS: Record<AppLocale, Record<string, string>> = {
  es: {
    announced: "Solicitud ingresada",
    capacity_change: "Cambio de capacidad",
    ownership_change: "Cambio de propiedad",
    developer_change: "Cambio de desarrollador",
    connection_date_change: "Cambio de fecha de conexión",
    connection_point_change: "Cambio de punto de conexión",
    construction_date_change: "Cambio de fecha de construcción",
    status_change: "Cambio de estado",
    seia_milestone: "Hito ambiental",
    delay: "Retraso",
    other: "Actualización",
  },
  en: {
    announced: "Request added",
    capacity_change: "Capacity change",
    ownership_change: "Ownership change",
    developer_change: "Developer change",
    connection_date_change: "Connection date change",
    connection_point_change: "Connection point change",
    construction_date_change: "Construction date change",
    status_change: "Status change",
    seia_milestone: "Environmental milestone",
    delay: "Delay",
    other: "Update",
  },
};

/**
 * Un tipo de evento que la fuente empiece a emitir mañana no tiene por qué
 * romper la tabla: se muestra la clave sin guiones bajos, como antes, en vez de
 * dejar la celda vacía.
 */
export function projectEventLabel(eventType: string, locale: AppLocale = "es"): string {
  return PROJECT_EVENT_LABELS[locale][eventType] ?? eventType.replaceAll("_", " ");
}
