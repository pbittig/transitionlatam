import { escapeHtml, sanitizeEmailSubjectPart, sendInternalNotification } from "./resend";
import { SERVICE_LABELS, TIMING_LABELS, CONTACT_LABELS } from "@/lib/shared/serviceRequestLabels";

const SERVICE_REQUEST_NOTIFICATION_EMAIL = "patrick.bittig@onixcg.com";

export interface ServiceRequestNotificationInput {
  serviceType: string;
  description: string;
  desiredTiming: string;
  contactMethod: string;
  profile: {
    fullName: string | null;
    email: string;
    companyName: string | null;
    mobilePhone: string | null;
  };
  /** Prefijo opcional para el subject — usado por la prueba manual para no confundirse con un requerimiento real. */
  subjectPrefix?: string;
}

/** Aviso interno de un nuevo requerimiento en "Servicios Adicionales" — no bloquea el envío del formulario si falla (ver createServiceRequest). */
export async function notifyNewServiceRequest(input: ServiceRequestNotificationInput): Promise<void> {
  const serviceLabel = SERVICE_LABELS[input.serviceType] ?? input.serviceType;
  const subject = `${input.subjectPrefix ?? ""}Nuevo requerimiento: ${sanitizeEmailSubjectPart(serviceLabel)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h1 style="font-size: 18px; margin: 0 0 8px;">Nuevo requerimiento de Servicios Adicionales</h1>
      <table style="font-size: 14px; line-height: 1.8; color: #333;">
        <tr><td style="padding-right: 14px; color: #888;">Tipo</td><td>${escapeHtml(serviceLabel)}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Plazo</td><td>${escapeHtml(TIMING_LABELS[input.desiredTiming] ?? input.desiredTiming)}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Contacto preferido</td><td>${escapeHtml(CONTACT_LABELS[input.contactMethod] ?? input.contactMethod)}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Nombre</td><td>${escapeHtml(input.profile.fullName ?? "—")}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Correo</td><td>${escapeHtml(input.profile.email)}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Empresa</td><td>${escapeHtml(input.profile.companyName ?? "—")}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Teléfono</td><td>${escapeHtml(input.profile.mobilePhone ?? "—")}</td></tr>
        <tr><td style="padding-right: 14px; color: #888;">Fecha</td><td>${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</td></tr>
      </table>
      <p style="font-size: 14px; line-height: 1.6; color: #333; margin-top: 16px; white-space: pre-wrap;">${escapeHtml(input.description)}</p>
    </div>
  `;

  await sendInternalNotification({ to: SERVICE_REQUEST_NOTIFICATION_EMAIL, subject, html });
}
