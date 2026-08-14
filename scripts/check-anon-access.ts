// Qué puede leer un desconocido con la anon key, sin cuenta ni sesión.
//
// La anon key viaja al navegador: es pública por diseño. Lo que decide qué se
// puede sacar con ella son las políticas RLS, no la app. Este script pregunta
// lo mismo que preguntaría un tercero — un select por REST, tabla por tabla — y
// reporta cuántas filas contesta la base.
//
// Se usó para medir el hallazgo "Crítico" de docs/security-audit-2026-07-29.md
// (23 tablas abiertas el 2026-08-12) y sirve de verificación después de aplicar
// `20260812000005_restrict_public_reads_to_authenticated.sql`: si esa migración
// está puesta, lo único que debería quedar en la lista es el catálogo de planes.
//
// No escribe nada. Correrlo cuando se toque cualquier policy de lectura.
//
// Uso:
//   node_modules/.bin/tsx scripts/check-anon-access.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

// Se espera que `anon` pueda leer esto y solo esto: es el catálogo comercial y
// la página de precios es pública. Cualquier otra tabla en la salida es un
// hallazgo, no un dato de contexto.
const ESPERADAS_PUBLICAS = new Set(["plan", "plan_feature", "feature"]);

const TABLAS = [
  "ai_chat_message", "ai_usage_event", "app_setting", "behavior_event", "cne_capacidad_sync_log",
  "cne_construccion_sync_log", "company", "company_shareholding", "connection_status", "construction_project",
  "coordinador_empresa", "country", "cron_run_log", "data_attribution", "data_source", "entitlement_override",
  "entity_alias", "entity_relationship", "feature", "followed_project", "formulario_ingest_log", "lead",
  "lead_score", "location", "market_signal", "nexo_run", "nexo_tool_call", "opportunity", "opportunity_activity",
  "organization", "ownership_entity", "ownership_relation", "pelp_carrier", "pelp_expansion",
  "pelp_extraction_run", "pelp_node", "pelp_scenario", "pelp_storage_asset", "person", "pertinencia_consulta",
  "pgp_project_progress_observation", "plan", "plan_feature", "power_plant", "project", "project_connection",
  "project_event", "project_ownership_profile", "project_preverification", "region", "request_rate_log",
  "schedule_calibration_stat", "seia_record", "service_request", "spv", "substation", "technology",
  "transmission_line", "user_profile",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");

  const anon = createClient(url, anonKey);
  const abiertas: Array<{ tabla: string; filas: number; columnas: number; esperada: boolean }> = [];

  for (const tabla of TABLAS) {
    const { data, count, error } = await anon.from(tabla).select("*", { count: "exact" }).limit(1);
    // Un error acá es la tabla negando el acceso, que es el resultado deseado —
    // no un fallo del chequeo. Cero filas también cierra: puede ser una policy
    // que filtra todo o una tabla vacía, y en ninguno de los dos casos se filtra
    // información.
    if (error || !count) continue;
    abiertas.push({
      tabla,
      filas: count,
      columnas: data?.[0] ? Object.keys(data[0]).length : 0,
      esperada: ESPERADAS_PUBLICAS.has(tabla),
    });
  }

  const inesperadas = abiertas.filter((t) => !t.esperada);

  console.log(`Tablas que contestan a la anon key: ${abiertas.length}`);
  for (const t of abiertas) {
    console.log(`  ${t.esperada ? "ok " : "!! "} ${t.tabla.padEnd(26)} ${String(t.filas).padStart(7)} filas, ${t.columnas} columnas`);
  }

  if (inesperadas.length === 0) {
    console.log("\nSolo queda abierto el catálogo de planes. Es lo esperado.");
    return;
  }

  console.log(`\n${inesperadas.length} tabla(s) fuera del catálogo de planes siguen abiertas a cualquiera sin cuenta.`);
  console.log("Si esto sale después de aplicar 20260812000005, la migración no está puesta o no cubre estas tablas.");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
