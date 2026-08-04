import { createBrowserClient } from "@supabase/ssr";

/**
 * Único caso donde necesitamos un cliente de navegador: el link de
 * recuperación de clave puede llegar con el flujo implícito de Supabase
 * (tokens en el fragmento #access_token=... de la URL), que nunca llega al
 * servidor — solo el navegador puede leerlo y establecer la sesión con él.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
