"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { isAppLocale } from "@/lib/i18n";
import { escapeHtml, sanitizeEmailSubjectPart, sendInternalNotification } from "@/lib/notifications/resend";
import { notifyNewServiceRequest } from "@/lib/notifications/serviceRequestAlerts";

export interface ServiceRequestState {
  success?: boolean;
  error?: string;
}

export interface PrimeInterestState {
  success?: boolean;
  error?: string;
}

const PRIME_NOTIFICATION_EMAIL = "patrick.bittig@onixcg.com";

const SERVICE_TYPES = new Set([
  "market_study",
  "market_intelligence",
  "project_intelligence",
  "commercial_strategy",
  "custom_analysis",
  "other",
]);
const TIMINGS = new Set(["as_soon_as_possible", "this_month", "this_quarter", "exploratory"]);
const CONTACT_METHODS = new Set(["email", "phone", "meeting"]);

export async function createServiceRequest(
  _previousState: ServiceRequestState,
  formData: FormData,
): Promise<ServiceRequestState> {
  const localeValue = String(formData.get("locale") ?? "es");
  const locale = isAppLocale(localeValue) ? localeValue : "es";
  const message = (es: string, en: string) => locale === "en" ? en : es;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: message("Su sesión expiró. Vuelva a ingresar para enviar el requerimiento.", "Your session has expired. Please sign in again to submit the request.") };

  const profile = await getCurrentUserProfile(client);
  if (!profile) return { error: message("No encontramos el perfil asociado a su cuenta.", "We could not find the profile associated with your account.") };

  const serviceType = String(formData.get("serviceType") ?? "");
  const desiredTiming = String(formData.get("desiredTiming") ?? "");
  const contactMethod = String(formData.get("contactMethod") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!SERVICE_TYPES.has(serviceType) || !TIMINGS.has(desiredTiming) || !CONTACT_METHODS.has(contactMethod)) {
    return { error: message("Revise las opciones seleccionadas.", "Please review the selected options.") };
  }
  if (description.length < 20) return { error: message("Proporcione un poco más de información sobre el requerimiento.", "Please provide additional information about the request.") };
  if (description.length > 4000) return { error: message("El requerimiento no puede superar los 4.000 caracteres.", "The request cannot exceed 4,000 characters.") };

  const { error } = await client.from("service_request").insert({
    auth_user_id: user.id,
    user_profile_id: profile.id,
    service_type: serviceType,
    description,
    desired_timing: desiredTiming,
    contact_method: contactMethod,
  });
  if (error) return { error: message(`No pudimos enviar el requerimiento: ${error.message}`, `We could not submit the request: ${error.message}`) };

  try {
    await notifyNewServiceRequest({
      serviceType,
      description,
      desiredTiming,
      contactMethod,
      profile: {
        fullName: profile.fullName,
        email: profile.email,
        companyName: profile.companyName,
        mobilePhone: profile.mobilePhone,
      },
    });
  } catch (notificationError) {
    console.error("[service-request] No se pudo enviar la notificación:", notificationError instanceof Error ? notificationError.message : notificationError);
  }

  revalidatePath("/servicios-adicionales");
  revalidatePath("/admin/requerimientos");
  return { success: true };
}

export async function confirmPrimeInterest(
  _previousState: PrimeInterestState,
  formData: FormData,
): Promise<PrimeInterestState> {
  const localeValue = String(formData.get("locale") ?? "es");
  const locale = isAppLocale(localeValue) ? localeValue : "es";
  const message = (es: string, en: string) => locale === "en" ? en : es;
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { error: message("Su sesión expiró. Vuelva a ingresar para confirmar su interés.", "Your session has expired. Please sign in again to confirm your interest.") };
  }

  const profile = await getCurrentUserProfile(client);
  if (!profile) {
    return { error: message("No encontramos el perfil asociado a su cuenta.", "We could not find the profile associated with your account.") };
  }

  const { data: existing } = await client
    .from("service_request")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("service_type", "prime_subscription")
    .neq("status", "closed")
    .limit(1)
    .maybeSingle();

  if (existing) return { success: true };

  const { error } = await client.from("service_request").insert({
    auth_user_id: user.id,
    user_profile_id: profile.id,
    service_type: "prime_subscription",
    description: "Interés confirmado en contratar el plan Prime. Solicita contrato de servicio y enlace de pago.",
    desired_timing: "as_soon_as_possible",
    contact_method: "email",
  });

  if (error) {
    return { error: message(`No pudimos confirmar su interés: ${error.message}`, `We could not confirm your interest: ${error.message}`) };
  }

  try {
    await sendInternalNotification({
      to: PRIME_NOTIFICATION_EMAIL,
      subject: `Interés en Prime: ${sanitizeEmailSubjectPart(profile.fullName ?? profile.email)}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
          <h1 style="font-size: 18px; margin: 0 0 8px;">Nuevo interés confirmado en contratar Prime</h1>
          <p style="font-size: 14px; line-height: 1.6; color: #555;">La persona solicita ser contactada para recibir el contrato de servicio y el enlace de pago.</p>
          <table style="font-size: 14px; line-height: 1.8; color: #333;">
            <tr><td style="padding-right: 14px; color: #888;">Nombre</td><td>${escapeHtml(profile.fullName ?? "—")}</td></tr>
            <tr><td style="padding-right: 14px; color: #888;">Correo</td><td>${escapeHtml(profile.email)}</td></tr>
            <tr><td style="padding-right: 14px; color: #888;">Empresa</td><td>${escapeHtml(profile.companyName ?? "—")}</td></tr>
            <tr><td style="padding-right: 14px; color: #888;">Teléfono</td><td>${escapeHtml(profile.mobilePhone ?? "—")}</td></tr>
            <tr><td style="padding-right: 14px; color: #888;">Fecha</td><td>${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</td></tr>
          </table>
        </div>
      `,
    });
  } catch (notificationError) {
    console.error("[prime-interest] No se pudo enviar la notificación:", notificationError instanceof Error ? notificationError.message : notificationError);
  }

  revalidatePath("/contratar-prime");
  revalidatePath("/admin/requerimientos");
  return { success: true };
}
