import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "./supabase-server-client";
import { createSupabaseServiceClient } from "./supabase-service-client";

/**
 * El cliente con el que las páginas de cliente leen datos.
 *
 * EL PROBLEMA: la sesión de administrador es una cookie propia firmada con
 * SESSION_SECRET, no una sesión de Supabase Auth. Para la base, un admin
 * navegando /proyectos u /operacion es el rol `anon`. Mientras `anon` podía
 * leerlo todo eso no se notaba; desde que se cerró (2026-08-12 en adelante) el
 * admin pasó a ver las páginas vacías — sin tabla, sin GW, sin chips de
 * tecnología — porque no puede leer `technology`, `location` ni `company`.
 *
 * Un cliente de verdad nunca vio ese problema: entra con sesión de Supabase y
 * es `authenticated`, que es a quien las policies le hablan.
 *
 * LA DECISIÓN (usuario, 2026-08-16): el admin lee saltando RLS, igual que ya
 * hace todo /admin. Es el mismo nivel de acceso que ya tiene por otras vías, y
 * evita mantener un usuario de Supabase paralelo solo para esto.
 *
 * LO QUE CUESTA: lo que ve el admin deja de ser lo que ve un cliente. No sirve
 * para revisar la experiencia real — un proyecto oculto por tecnología o por
 * estado igual le va a aparecer. Para esa pregunta está
 * `scripts/check-project-visibility.ts`, que consulta como `authenticated` de
 * verdad y corre todos los días.
 *
 * NO usar para autenticación ni para leer el perfil del usuario: ahí hace falta
 * la sesión real (`createSupabaseServerClient`), porque el cliente de servicio
 * no tiene `auth.uid()` y devolvería null.
 */
export async function createSupabasePageClient(): Promise<SupabaseClient> {
  if (await isAdmin()) return createSupabaseServiceClient();
  return createSupabaseServerClient();
}
