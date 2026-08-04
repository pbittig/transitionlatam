import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";

/**
 * Único punto donde se intercambia un código de recuperación de clave (link
 * enviado por Supabase vía resetPasswordForEmail) por una sesión real — tiene
 * que ser un Route Handler, no una Server Action ni un Server Component en
 * render, porque establecer la sesión requiere escribir cookies (ver
 * comentario de proxy.ts sobre esta misma restricción).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/restablecer-clave";

  if (code) {
    const client = await createSupabaseServerClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/recuperar-clave?error=link_invalido", request.url));
}
