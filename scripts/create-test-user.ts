/**
 * Crea (o reactiva) un usuario de prueba con correo ya confirmado, para poder
 * abrir las páginas que exigen sesión de Supabase — /proyectos-esperados,
 * /mercado, /proyectos — sin pasar por el registro y la confirmación por mail.
 *
 * La sesión de administrador (cookie `session`, JWT propio) NO sirve para eso:
 * abre la ficha, pero para Supabase es un cliente anónimo, así que las páginas
 * que dependen de `auth.uid()` redirigen a /ingresar.
 *
 *   npx tsx scripts/create-test-user.ts [correo] [clave] [--plan premium]
 *
 * Sin argumentos usa qa@transitionlatam.test / TransitionQA2026!. El plan por
 * defecto es premium para que no queden secciones bloqueadas por PlanGate
 * durante una revisión visual.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const DEFAULT_EMAIL = "qa@transitionlatam.test";
const DEFAULT_PASSWORD = "TransitionQA2026!";

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const email = args[0] ?? DEFAULT_EMAIL;
  const password = args[1] ?? DEFAULT_PASSWORD;
  const planIndex = process.argv.indexOf("--plan");
  const planCode = planIndex >= 0 ? process.argv[planIndex + 1] : "premium";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");

  // Mismo workaround que el resto de los scripts: la key `sb_secret_` no va como Bearer.
  const serviceRoleFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) headers.delete("authorization");
    return fetch(input, { ...init, headers });
  };
  const client = createClient(url, serviceKey, { global: { fetch: serviceRoleFetch }, auth: { persistSession: false } });

  // `email_confirm: true` evita el mail de confirmación: sin esto el usuario
  // queda creado pero no puede iniciar sesión.
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "QA Transition Latam" },
  });

  let authUserId = created?.user?.id ?? null;
  if (createError) {
    // Ya existía: se le resetea la clave para dejarlo utilizable igual.
    const { data: list } = await client.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw new Error(`No se pudo crear ni encontrar el usuario: ${createError.message}`);
    authUserId = existing.id;
    const { error: updateError } = await client.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (updateError) throw new Error(`El usuario existe pero no se pudo actualizar su clave: ${updateError.message}`);
    console.log(`Usuario ya existía — clave actualizada.`);
  } else {
    console.log("Usuario creado.");
  }
  if (!authUserId) throw new Error("Supabase no devolvió el id del usuario.");

  const { data: plan } = await client.from("plan").select("id, code").eq("code", planCode).maybeSingle();
  if (!plan) throw new Error(`No existe el plan "${planCode}".`);

  // Mismo payload que app/registro/actions.ts, sin el trial: este usuario es
  // para revisar la aplicación, no para probar el embudo de conversión.
  const profile = {
    auth_user_id: authUserId,
    email,
    full_name: "QA Transition Latam",
    company_name: "Transition Latam",
    role: "QA",
    user_type: "other",
    country: "CL",
    plan_id: plan.id,
    preferred_language: "es",
  };
  const { data: existingProfile } = await client.from("user_profile").select("id").eq("auth_user_id", authUserId).maybeSingle();
  const { error: profileError } = existingProfile
    ? await client.from("user_profile").update(profile).eq("auth_user_id", authUserId)
    : await client.from("user_profile").insert(profile);
  if (profileError) throw new Error(`No se pudo dejar el perfil listo: ${profileError.message}`);

  console.log(`\n  Correo: ${email}\n  Clave:  ${password}\n  Plan:   ${plan.code}\n\nEntrar por /ingresar.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
