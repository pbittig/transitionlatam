import { createServerClient } from "@supabase/ssr";
import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PAGE_PATHS = new Set([
  "/ingresar",
  "/registro",
  "/planes",
  "/plans",
  "/admin/acceso",
  "/recuperar-clave",
  "/restablecer-clave",
]);

async function hasValidAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return payload.role === "admin";
  } catch {
    return false;
  }
}

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
  const englishPaths = ["/projects", "/operations", "/owners", "/tracking", "/dynamic-analysis", "/services", "/plans", "/subscribe-prime"];
  const spanishPaths = ["/proyectos", "/operacion", "/propietarios", "/seguimiento", "/analisis-dinamico", "/servicios", "/planes", "/contratar-prime"];
  const requestedLocale = englishPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))
    ? "en"
    : spanishPaths.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))
      ? "es"
      : null;
  if (requestedLocale) request.cookies.set("transition-locale", requestedLocale);

  const legacyRoutes: Record<string, string> = {
    "/proyectos-esperados": "/proyectos",
    "/mercado": "/operacion",
    "/mapa-stakeholder": "/propietarios",
    "/alertas": "/seguimiento",
  };
  const canonicalPath = legacyRoutes[request.nextUrl.pathname];
  if (canonicalPath) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = canonicalPath;
    return NextResponse.redirect(canonicalUrl);
  }

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicPage = PUBLIC_PAGE_PATHS.has(pathname);
  const isApiRoute = pathname.startsWith("/api/");

  if (!isPublicPage && !isApiRoute && !user && !(await hasValidAdminSession(request))) {
    // /admin/* sin sesión de admin va al login de admin, no al de cliente —
    // antes mandaba todo a /ingresar, así que entrar directo a /admin te
    // dejaba en el login equivocado.
    const loginPath = pathname.startsWith("/admin") ? "/admin/acceso" : "/ingresar";
    const loginUrl = new URL(loginPath, request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Conserva cualquier cookie de Supabase que se haya refrescado antes de
    // detectar que no existe una sesión válida.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  if (requestedLocale) {
    supabaseResponse.cookies.set("transition-locale", requestedLocale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
