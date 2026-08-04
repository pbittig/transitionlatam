"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

export interface RecuperarClaveState {
  message?: string;
  error?: string;
}

async function getSiteOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "transitionlatam.com";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function recuperarClave(
  _prevState: RecuperarClaveState | undefined,
  formData: FormData,
): Promise<RecuperarClaveState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Ingrese su correo." };

  const client = await createSupabaseServerClient();
  const origin = await getSiteOrigin();
  await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/confirm?next=/restablecer-clave`,
  });

  // Mismo mensaje exista o no la cuenta — no revela qué correos están registrados.
  return {
    message:
      "Si existe una cuenta con ese correo, enviaremos un enlace para restablecer la clave. Revise su bandeja de entrada y la carpeta de spam en los próximos minutos.",
  };
}
