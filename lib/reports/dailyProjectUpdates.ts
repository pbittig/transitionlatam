import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { escapeHtml, sendInternalNotification } from "@/lib/notifications/resend";
import { projectEventLabel } from "@/lib/shared/projectEventLabels";

const REPORT_RECIPIENT = process.env.DAILY_PROJECT_REPORT_EMAIL ?? "patrick.bittig@onixcg.com";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://transitionlatam.com").replace(/\/$/, "");

type ProjectRef = { id: string; name: string } | null;
type SourceRef = { name: string } | null;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value));
}

function projectLink(project: ProjectRef) {
  if (!project) return "Proyecto sin vínculo";
  return `<a href="${APP_URL}/proyectos/${encodeURIComponent(project.id)}" style="color:#176b63;font-weight:600">${escapeHtml(project.name)}</a>`;
}

/**
 * La celda "Proyecto" de la tabla SEIA.
 *
 * Un tercio de los expedientes (66 de 250, medido el 2026-08-18) todavía no
 * está cruzado con un proyecto de la plataforma. Antes esas filas decían
 * "Proyecto sin vínculo" y nada más: el lector no podía saber de qué proyecto
 * se trataba ni ir a mirarlo. El expediente SÍ trae su propio nombre, su
 * titular y el enlace a su ficha en el SEIA, así que se muestran esos: el
 * vínculo que falta es con nuestra base, no con la realidad.
 */
function seiaProjectCell(row: {
  project: ProjectRef;
  nombre: string | null;
  titular_name: string | null;
  url_ficha: string | null;
}) {
  if (row.project) return projectLink(row.project);

  const nombre = row.nombre?.trim() || "Expediente sin nombre en la fuente";
  const titulo = row.url_ficha
    ? `<a href="${escapeHtml(row.url_ficha)}" style="color:#176b63;font-weight:600">${escapeHtml(nombre)}</a>`
    : `<span style="font-weight:600">${escapeHtml(nombre)}</span>`;
  const pie = [row.titular_name?.trim(), "aún sin ficha en la plataforma"].filter(Boolean).join(" · ");
  return `${titulo}<div style="color:#888;font-size:12px;margin-top:2px">${escapeHtml(pie)}</div>`;
}

function table(headers: string[], rows: string[][], emptyMessage: string) {
  if (!rows.length) return `<p style="color:#666">${escapeHtml(emptyMessage)}</p>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${headers.map((header) => `<th style="padding:8px;border-bottom:1px solid #ddd;text-align:left">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top">${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export async function sendDailyProjectUpdatesReport(since = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  const client = createSupabaseServiceClient();
  const sinceIso = since.toISOString();
  const [eventResult, seiaResult] = await Promise.all([
    client
      .from("project_event")
      .select("event_type, occurred_at, recorded_at, description, project:project_id(id, name), source:data_source_id(name)")
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: false }),
    client
      .from("seia_record")
      .select(
        "seia_id, status, submission_type, filed_at, created_at, updated_at, nombre, titular_name, url_ficha, project:project_id(id, name)",
      )
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false }),
  ]);
  if (eventResult.error) throw new Error(`No se pudieron consultar eventos de Acceso Abierto: ${eventResult.error.message}`);
  if (seiaResult.error) throw new Error(`No se pudieron consultar novedades SEIA: ${seiaResult.error.message}`);

  const accessEvents = (eventResult.data ?? []).filter((row) => {
    const source = row.source as unknown as SourceRef;
    return !source?.name || /acceso abierto|coordinador/i.test(source.name);
  });
  const seiaUpdates = seiaResult.data ?? [];
  const period = `${formatDate(sinceIso)} a ${formatDate(new Date().toISOString())}`;
  const accessRows = accessEvents.map((row) => [
    projectLink(row.project as unknown as ProjectRef),
    escapeHtml(projectEventLabel(String(row.event_type))),
    escapeHtml(row.description ?? "Cambio detectado en la fuente"),
    escapeHtml(formatDate(row.recorded_at)),
  ]);
  const seiaRows = seiaUpdates.map((row) => [
    seiaProjectCell({
      project: row.project as unknown as ProjectRef,
      nombre: row.nombre as string | null,
      titular_name: row.titular_name as string | null,
      url_ficha: row.url_ficha as string | null,
    }),
    escapeHtml(row.seia_id ?? "Sin ID"),
    escapeHtml([row.submission_type, row.status].filter(Boolean).join(" · ") || "Sin estado"),
    escapeHtml(formatDate(row.updated_at)),
  ]);

  const html = `<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;max-width:900px;margin:auto">
    <h1 style="font-size:22px">Novedades diarias de proyectos</h1>
    <p style="color:#666">Período: ${escapeHtml(period)}</p>
    <p><strong>${accessRows.length}</strong> cambios de Acceso Abierto · <strong>${seiaRows.length}</strong> novedades SEIA</p>
    <h2 style="font-size:18px;margin-top:28px">Acceso Abierto</h2>
    ${table(["Proyecto", "Tipo", "Detalle", "Detectado"], accessRows, "No se registraron cambios de Acceso Abierto en el período.")}
    <h2 style="font-size:18px;margin-top:28px">SEIA</h2>
    ${table(["Proyecto", "Expediente", "Estado", "Actualizado"], seiaRows, "No se registraron novedades SEIA en el período.")}
    <p style="margin-top:28px;color:#777;font-size:12px">Reporte automático de Transition LATAM basado en cambios almacenados en la plataforma.</p>
  </div>`;

  // `sent` viaja en el resumen a propósito: sin él, quien invoca este reporte
  // no puede distinguir "se envió" de "se omitió por falta de RESEND_API_KEY".
  const sent = await sendInternalNotification({
    to: REPORT_RECIPIENT,
    subject: `Transition LATAM: ${accessRows.length + seiaRows.length} novedades de proyectos`,
    html,
  });
  return { recipient: REPORT_RECIPIENT, accessOpen: accessRows.length, seia: seiaRows.length, since: sinceIso, sent };
}
