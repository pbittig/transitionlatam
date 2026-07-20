import { createClient } from "@supabase/supabase-js";

/**
 * Uses the service_role key, which bypasses RLS — see /docs/09-seguridad.md §9.8.
 * Only for backend jobs (ingestion, scoring, admin tooling). Never import this
 * from client components or expose it to the browser.
 */
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
