"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/data-access/supabase-browser-client";
import { RestablecerClaveForm } from "./RestablecerClaveForm";
import type { AppLocale } from "@/lib/i18n";

type Status = "checking" | "ready" | "invalid";

/**
 * Fallback client-side para cuando el servidor no encontró sesión (el link de
 * recuperación puede llegar con el flujo implícito de Supabase — tokens en el
 * fragmento #access_token=... de la URL, que el servidor nunca ve, solo el
 * navegador). Si el servidor ya encontró sesión (flujo PKCE con ?code=,
 * intercambiado en /api/auth/confirm), esta pantalla ni se muestra.
 */
export function RestablecerClaveClient({ locale = "es" }: { locale?: AppLocale }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) {
      setStatus("invalid");
      return;
    }
    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      setStatus("invalid");
      return;
    }

    const client = createSupabaseBrowserClient();
    client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      // Limpia el fragmento de la URL apenas se usa — no debe quedar visible
      // en el historial del navegador.
      window.history.replaceState(null, "", window.location.pathname);
      setStatus(error ? "invalid" : "ready");
    });
  }, []);

  if (status === "checking") {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">{locale === "en" ? "Checking link..." : "Verificando link..."}</p>;
  }

  if (status === "ready") {
    return <RestablecerClaveForm locale={locale} />;
  }

  return (
    <div className="flex flex-col gap-3 text-sm text-neutral-600 dark:text-neutral-400">
      <p>{locale === "en" ? "This link is invalid or has expired." : "Este link no es válido o ya venció."}</p>
      <Link href="/recuperar-clave" className="font-semibold text-brand-deep hover:underline dark:text-brand-primary">
        {locale === "en" ? "Request a new link" : "Solicitar un link nuevo"}
      </Link>
    </div>
  );
}
