import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * El repaso de fichas ya verificadas, como una cola que se vacía.
 *
 * EL PROBLEMA QUE RESUELVE: "Repasar verificados" filtraba por `verified_at is
 * not null`. Al guardar, `markProjectVerified` actualiza `verified_at` a ahora
 * — pero sigue sin ser null, así que el proyecto volvía a calzar y la lista no
 * bajaba nunca. El dato se guardaba bien; lo que faltaba era distinguir
 * "verificado alguna vez" de "verificado en este repaso".
 *
 * CÓMO FUNCIONA: se guarda el instante en que empezó el repaso. La cola son las
 * fichas con `verified_at` ANTERIOR a ese instante. Al re-verificar una,
 * `verified_at` pasa a ser posterior y la ficha sale de la cola sola. El
 * contador baja de verdad: 190, 189, 188.
 *
 * Se guarda el inicio y no una marca por proyecto porque así "empezar otra
 * vuelta" es escribir una fecha, no borrar 190 banderas. Y porque la fecha de
 * corte se explica sola al leerla, mientras que una bandera booleana no dice
 * de qué vuelta era.
 */
export const REVERIFICATION_PASS_KEY = "reverification_pass_started_at";

/**
 * Devuelve el corte del repaso vigente, o null si nunca se inició.
 *
 * Con null, quien consulte debe tratar TODA ficha verificada como pendiente de
 * repaso: es el comportamiento anterior, y es el que menos sorprende — nunca
 * esconde trabajo que falta por hacer.
 */
export async function getReverificationPassStart(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.from("app_setting").select("value").eq("key", REVERIFICATION_PASS_KEY).maybeSingle();
  const value = data?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Empieza una vuelta nueva: todo lo verificado hasta este instante vuelve a la cola. */
export async function startReverificationPass(client: SupabaseClient, at: string = new Date().toISOString()): Promise<void> {
  const { error } = await client
    .from("app_setting")
    .upsert({ key: REVERIFICATION_PASS_KEY, value: at, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error iniciando el repaso: ${error.message}`);
}
