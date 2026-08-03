"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getAppLocale } from "@/lib/i18n";
import { sendInternalNotification, escapeHtml, sanitizeEmailSubjectPart } from "@/lib/notifications/resend";

export interface RegistroState {
  error?: string;
  /** Mensaje de éxito distinto de un redirect — ej. "revisa tu correo" cuando Supabase exige confirmación. */
  message?: string;
}

const TRIAL_DAYS = 14;

// Quién recibe la copia interna de cada registro nuevo (ficha del usuario).
// Simple por ahora — si mañana son varias personas, esto pasa a ser una lista
// o una tabla, pero no antes de que haga falta.
const NEW_REGISTRATION_NOTIFICATION_EMAIL = "patrick.bittig@onixcg.com";

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
  const mobilePhone = String(formData.get("mobilePhone") ?? "").trim();
  const userType = String(formData.get("userType") ?? "other");
  const country = String(formData.get("country") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !companyName || !mobilePhone || !password) {
    return { error: "Completa todos los campos." };
  }
  const mobileDigits = mobilePhone.replace(/\D/g, "");
  if (mobileDigits.length < 8 || mobileDigits.length > 15 || !/^\+?[\d\s()-]+$/.test(mobilePhone)) {
    return { error: "Ingresa un teléfono móvil válido, incluyendo el código de país." };
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

  if (!signUpData.user) {
    return { error: "No pudimos crear la cuenta. Intenta de nuevo." };
  }

  // El perfil se crea con el cliente de service role (no el de sesión): cuando
  // Supabase exige confirmar el correo, signUp() no deja una sesión activa
  // todavía, así que auth.uid() sería null y la política RLS de inserción
  // (auth.uid() = auth_user_id) rechazaría el insert con el cliente normal.
  // El service role no depende de la sesión, así que el perfil queda listo
  // desde ya, sin esperar a que el usuario confirme el correo.
  const serviceClient = createSupabaseServiceClient();
  const { data: freePlan } = await serviceClient.from("plan").select("id").eq("code", "free").maybeSingle();

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const profilePayload = {
    auth_user_id: signUpData.user.id,
    email,
    full_name: fullName,
    company_name: companyName,
    mobile_phone: mobilePhone,
    user_type: userType,
    country,
    plan_id: freePlan?.id ?? null,
    trial_ends_at: trialEndsAt,
    preferred_language: preferredLanguage,
  };
  let { error: profileError } = await serviceClient.from("user_profile").insert(profilePayload);
  if (profileError?.code === "42703" || profileError?.code === "PGRST204") {
    const { preferred_language: _preferredLanguage, mobile_phone: _mobilePhone, ...legacyPayload } = profilePayload;
    void _preferredLanguage;
    void _mobilePhone;
    const retry = await serviceClient.from("user_profile").insert(legacyPayload);
    profileError = retry.error;
  }
  if (profileError) {
    return { error: `No pudimos completar tu perfil: ${profileError.message}` };
  }

  // No debe bloquear el registro si falla — el usuario ya tiene su cuenta y su
  // perfil creados; esto es solo la copia interna para ONIX.
  try {
    await sendInternalNotification({
      to: NEW_REGISTRATION_NOTIFICATION_EMAIL,
      subject: `Nuevo registro: ${sanitizeEmailSubjectPart(fullName)} (${sanitizeEmailSubjectPart(companyName)})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
          <h1 style="font-size: 18px; font-weight: 600; margin: 0 0 16px;">Nuevo registro en Transition LATAM</h1>
          <table style="font-size: 14px; line-height: 1.8; color: #333333;">
            <tr><td style="padding-right: 12px; color: #888;">Nombre</td><td>${escapeHtml(fullName)}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">Correo</td><td>${escapeHtml(email)}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">Empresa</td><td>${escapeHtml(companyName)}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">Teléfono</td><td>${escapeHtml(mobilePhone)}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">Tipo</td><td>${escapeHtml(userType)}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">País</td><td>${escapeHtml(country ?? "—")}</td></tr>
            <tr><td style="padding-right: 12px; color: #888;">Fecha</td><td>${new Date().toLocaleString("es-CL")}</td></tr>
          </table>
        </div>
      `,
    });
  } catch (err) {
    console.error("[registro] No se pudo enviar la notificación interna:", (err as Error).message);
  }

  // Sin sesión: Supabase exige confirmar el correo antes de dejar entrar — el
  // perfil ya quedó creado arriba, solo falta que confirme el email para
  // poder iniciar sesión en /ingresar.
  if (!signUpData.session) {
    return {
      message: `Cuenta creada. Revisa tu correo (${email}) y confirma tu cuenta antes de ingresar. Si no lo ves en los próximos minutos, revisa también la carpeta de spam/correo no deseado.`,
    };
  }

  redirect("/");
}
