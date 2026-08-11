/**
 * Envío de correo transaccional/interno vía Resend. Separado de la
 * confirmación de registro (esa la maneja el SMTP de Supabase directamente) —
 * esto es solo para notificaciones internas de ONIX (ej. nuevo registro).
 */
const RESEND_API_URL = "https://api.resend.com/emails";
const NOTIFICATIONS_FROM = "Transition LATAM <notificaciones@transitionlatam.com>";

/** Escapa texto arbitrario (ej. datos ingresados por un usuario) antes de interpolarlo en HTML de correo. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Limpia texto para usarlo en el subject de un correo: sin saltos de línea, largo acotado. */
export function sanitizeEmailSubjectPart(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 120);
}

/**
 * Devuelve `true` si el correo se envió y `false` si se omitió por falta de
 * `RESEND_API_KEY`. Antes devolvía `void`, y quien llamaba no podía distinguir
 * "enviado" de "silenciosamente omitido" — así el reporte diario estuvo
 * reportando éxito sin mandar nada. Un fallo real de la API sigue lanzando.
 */
export async function sendInternalNotification(params: {
  to: string;
  cc?: string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notifications] RESEND_API_KEY no configurada — se omite el envío.");
    return false;
  }
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: NOTIFICATIONS_FROM,
      to: [params.to],
      ...(params.cc?.length ? { cc: params.cc } : {}),
      subject: params.subject,
      html: params.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend respondió ${res.status}: ${body}`);
  }
  return true;
}
