"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

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
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Tu sesión expiró. Vuelve a ingresar para enviar el requerimiento." };

  const profile = await getCurrentUserProfile(client);
  if (!profile) return { error: "No encontramos el perfil asociado a tu cuenta." };

  const serviceType = String(formData.get("serviceType") ?? "");
  const desiredTiming = String(formData.get("desiredTiming") ?? "");
  const contactMethod = String(formData.get("contactMethod") ?? "");
  const description = String(formData.get("description") ?? "").trim();

  if (!SERVICE_TYPES.has(serviceType) || !TIMINGS.has(desiredTiming) || !CONTACT_METHODS.has(contactMethod)) {
    return { error: "Revisa las opciones seleccionadas." };
  }
  if (description.length < 20) return { error: "Cuéntanos un poco más sobre el requerimiento." };
  if (description.length > 4000) return { error: "El requerimiento no puede superar los 4.000 caracteres." };

  const { error } = await client.from("service_request").insert({
    auth_user_id: user.id,
    user_profile_id: profile.id,
    service_type: serviceType,
    description,
    desired_timing: desiredTiming,
    contact_method: contactMethod,
  });
  if (error) return { error: `No pudimos enviar el requerimiento: ${error.message}` };

  revalidatePath("/requerimientos");
  return { success: true };
}
