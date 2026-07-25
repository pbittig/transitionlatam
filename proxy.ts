import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca el token de sesión de Supabase Auth en cada request (usado por
 * app/ingresar, app/registro y app/(public)/perfil vía client.auth.getUser()).
 * Sin esto, la única otra oportunidad de refrescar el cookie es dentro de un
 * Server Component en render — pero Next.js no permite escribir cookies ahí
 * ("Cookies can only be modified in a Server Action or Route Handler"), así
 * que sesiones expiradas nunca se renovaban. Ver Manual de Marca aparte — esto
 * es infraestructura de auth, no diseño.
 *
 * Sigue el patrón oficial de @supabase/ssr para Next.js; el nombre del archivo
 * y de la función es "proxy" (no "middleware") porque esta versión de Next.js
 * renombró el concepto — misma funcionalidad (ver node_modules/next/dist/docs/
 * .../16-proxy.md).
 */
export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // No agregar lógica entre createServerClient y getUser() — un error acá
  // puede hacer muy difícil de depurar sesiones que se cierran solas.
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
