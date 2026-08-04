"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { isAppLocale } from "@/lib/i18n";

export interface ServiceRequestState {
  success?: boolean;
  error?: string;
}

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

  revalidatePath("/requerimientos");
  return { success: true };
}
