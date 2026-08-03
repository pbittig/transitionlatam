import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { sendInternalNotification } from "@/lib/notifications/resend";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  count: number;
  exceeded: boolean;
}

const ALERT_NOTIFICATION_EMAIL = "patrick.bittig@onixcg.com";

/**
 * Registra un evento de "bucket" (ej. "project_view", "project_list") para un
 * identificador (hoy: user_profile_id — visitantes anónimos no se trackean,
 * mismo criterio que behavior_event) y cuenta cuántos tuvo en la ventana.
 *
 * No bloquea nada por sí solo — MVP explícito en docs/09-seguridad.md §9.6:
 * alerta a operaciones ante un patrón sospechoso, no bloqueo automático de
 * cuenta (evita falsos positivos costosos con clientes reales). La alerta se
 * envía una sola vez por identificador+bucket+ventana (justo al cruzar el
 * umbral), no en cada request siguiente, para no inundar el correo.
 *
 * Usa el cliente de service role internamente (mismo criterio que
 * cron_run_log): request_rate_log tiene RLS activo sin policies — es
 * bookkeeping interno, no dato de usuario, así que el llamador nunca necesita
 * preocuparse de permisos.
 */
export async function recordAndCheckRate(
  identifier: string,
  bucket: string,
  { limit, windowSeconds }: RateLimitOptions,
): Promise<RateLimitResult> {
  const client = createSupabaseServiceClient();
  await client.from("request_rate_log").insert({ identifier, bucket });

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await client
    .from("request_rate_log")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("bucket", bucket)
    .gte("created_at", since);
  if (error) throw new Error(`Error verificando rate limit: ${error.message}`);

  const total = count ?? 0;
  const exceeded = total > limit;

  if (total === limit + 1) {
    try {
      await sendInternalNotification({
        to: ALERT_NOTIFICATION_EMAIL,
        subject: `Alerta de uso: ${identifier} superó el límite en "${bucket}"`,
        html: `<p>El identificador <code>${identifier}</code> superó ${limit} eventos de tipo <code>${bucket}</code> en los últimos ${windowSeconds} segundos. Podría ser un scraper o uso automatizado — revisar en <code>request_rate_log</code>.</p>`,
      });
    } catch (err) {
      console.error("[rateLimit] No se pudo enviar la alerta:", (err as Error).message);
    }
  }

  return { count: total, exceeded };
}
