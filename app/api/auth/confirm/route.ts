import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

/**
 * Único punto donde se intercambia un código de recuperación de clave (link
 * enviado por Supabase vía resetPasswordForEmail) por una sesión real — tiene
 * que ser un Route Handler, no una Server Action ni un Server Component en
 * render, porque establecer la sesión requiere escribir cookies (ver
 * comentario de proxy.ts sobre esta misma restricción).
 */
/** Solo rutas relativas propias — evita que "next" se use para un open redirect a otro dominio. */
function safeNextPath(rawNext: string | null): string {
  if (!rawNext) return "/restablecer-clave";
  const isRelative = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\");
  return isRelative ? rawNext : "/restablecer-clave";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.redirect(new URL("/recuperar-clave?error=link_invalido", request.url));
  }

  // Sin "code": puede ser el flujo implícito de Supabase, que manda los
  // tokens en el fragmento #access_token=... de la URL — el servidor nunca
  // lo ve, pero el navegador lo conserva a través de este redirect (no le
  // damos un fragmento propio al Location), así que igual mandamos a "next"
  // y ahí el cliente lo toma del hash. Recién si tampoco hay nada en el hash
  // se considera inválido — eso lo decide /restablecer-clave, no acá.
  return NextResponse.redirect(new URL(next, request.url));
}
