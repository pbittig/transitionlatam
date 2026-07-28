"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getAppLocale } from "@/lib/i18n";

export interface RegistroState {
  error?: string;
}

const TRIAL_DAYS = 14;

// Proveedores de correo personal/gratuito — el registro es B2B (identificamos
// empresa, no persona particular), así que exigimos correo corporativo.
const BLOCKED_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "hotmail.es",
  "outlook.com",
  "outlook.es",
  "live.com",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

export async function registrarse(_prevState: RegistroState | undefined, formData: FormData): Promise<RegistroState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const userType = String(formData.get("userType") ?? "other");
  const country = String(formData.get("country") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !companyName || !password) {
    return { error: "Completa todos los campos." };
  }
  if (password.length < 8) {
    return { error: "La clave debe tener al menos 8 caracteres." };
  }
  const emailDomain = email.split("@")[1];
  if (!emailDomain || BLOCKED_EMAIL_DOMAINS.has(emailDomain)) {
    return { error: "Usa tu correo corporativo — no aceptamos correos personales (Gmail, Hotmail, Outlook, etc.)." };
  }

  const client = await createSupabaseServerClient();
  const preferredLanguage = await getAppLocale();

  const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
  if (signUpError) {
    let message = `No pudimos crear la cuenta (${signUpError.message}).`;
    if (/already registered|already exists/i.test(signUpError.message)) {
      message = "Ya existe una cuenta con este correo.";
    } else if (/rate limit/i.test(signUpError.message)) {
      message = "Demasiados intentos de registro en poco tiempo — espera unos minutos y vuelve a intentar.";
    }
    return { error: message };
  }

  // Si el proyecto de Supabase tiene "Confirm email" activado, signUp no deja
  // una sesión activa (no hay proveedor de correo configurado para enviar la
  // confirmación) — sin sesión no podemos crear el perfil (la política RLS de
  // inserción exige auth.uid() = auth_user_id). Hay que desactivar esa
  // confirmación en el dashboard de Supabase para que este flujo funcione.
  if (!signUpData.session || !signUpData.user) {
    return {
      error:
        "La cuenta se creó pero no pudimos iniciar sesión automáticamente (falta confirmar el correo y no tenemos un proveedor de email configurado). Contacta al administrador.",
    };
  }

  const { data: freePlan } = await client.from("plan").select("id").eq("code", "free").maybeSingle();

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const profilePayload = {
    auth_user_id: signUpData.user.id,
    email,
    full_name: fullName,
    company_name: companyName,
    user_type: userType,
    country,
    plan_id: freePlan?.id ?? null,
    trial_ends_at: trialEndsAt,
    preferred_language: preferredLanguage,
  };
  let { error: profileError } = await client.from("user_profile").insert(profilePayload);
  if (profileError?.code === "42703" || profileError?.code === "PGRST204") {
    const { preferred_language: _preferredLanguage, ...legacyPayload } = profilePayload;
    void _preferredLanguage;
    const retry = await client.from("user_profile").insert(legacyPayload);
    profileError = retry.error;
  }
  if (profileError) {
    return { error: `No pudimos completar tu perfil: ${profileError.message}` };
  }

  redirect("/");
}
