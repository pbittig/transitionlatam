// Limpia las SPV que quedaron colgando de las empresas de plantilla del
// Formulario, antes de que `delete-template-test-data.mjs` pueda borrar esas
// empresas. Es el paso 2 de tres; el 1 (tapar la fuente) ya está hecho en
// `98c14a5`, y el 3 es el script de borrado.
//
// EL PROBLEMA: hasta el 2026-08-11 la ingesta del Formulario, cuando no lograba
// leer el titular real, guardaba los valores de relleno de la plantilla como si
// fueran el dato. Quedaron 49 filas de `spv` con una empresa inventada como
// matriz, y 30 proyectos REALES colgando de ellas por `project.spv_id`. Hoy
// "BESS BRIDGE 5", "Parque Eólico Kumleufú" y 25 más muestran como sociedad
// vehículo una "Empresa de Energía S.A." que no existe.
//
// DOS CASOS QUE NO SE TRATAN IGUAL:
//
//   a) SPV con nombre inventado (46). La sociedad entera es ficticia: se suelta
//      el `spv_id` de sus proyectos y se borra la fila. Un proyecto sin SPV es
//      un dato faltante; un proyecto con una SPV falsa es un dato equivocado, y
//      el segundo es peor.
//   b) SPV con nombre real (3: Bridge Almacenamiento Uno SpA, Bridge
//      Almacenamiento 2 SpA, CMS SPV III SpA). El Formulario traía la sociedad
//      correcta y el RUT de ejemplo sin corregir, así que la SPV es buena y solo
//      la matriz es inventada. Se les deja `parent_company_id` en null y NO se
//      tocan. Poner null es afirmar "no sabemos"; adivinarles una matriz sería
//      cambiar un dato falso por otro sin fuente que lo respalde.
//
// Qué cuenta como "inventado" NO se decide acá: se importa el mismo predicado
// que usa la ingesta para rechazarlos, para que no puedan desincronizarse. Los
// patrones están anclados justamente para que "Empresa de Transporte de
// Pasajeros Metro S.A." (Metro de Santiago, real) no caiga.
//
// Uso:
//   node_modules/.bin/tsx scripts/fix-template-spvs.ts           # simulación
//   node_modules/.bin/tsx scripts/fix-template-spvs.ts --apply   # aplica
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { isPlaceholderCompanyName } from "../lib/ingestion/sources/energia-abierta/detalle-formulario/load";

const apply = process.argv.includes("--apply");

/** Si alguna de estas apareciera entre las "inventadas", el predicado se rompió. */
const NUNCA_TOCAR = ["Empresa de Transporte de Pasajeros Metro S.A."];

interface SpvRow {
  id: string;
  name: string;
  parent_company_id: string | null;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: companies, error: companyError } = await client.from("company").select("id, name");
  if (companyError) throw new Error(companyError.message);

  const plantilla = (companies ?? []).filter((c) => isPlaceholderCompanyName(c.name as string));
  for (const c of plantilla) {
    if (NUNCA_TOCAR.includes(c.name as string)) {
      throw new Error(`El predicado marcó como plantilla a "${c.name}", que es una empresa real. Abortado.`);
    }
  }
  if (plantilla.length === 0) {
    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", nada_que_hacer: true }, null, 2));
    return;
  }
  const companyIds = plantilla.map((c) => c.id as string);

  const { data: spvsRaw, error: spvError } = await client
    .from("spv")
    .select("id, name, parent_company_id")
    .in("parent_company_id", companyIds);
  if (spvError) throw new Error(spvError.message);
  const spvs = (spvsRaw ?? []) as SpvRow[];

  const inventadas = spvs.filter((s) => isPlaceholderCompanyName(s.name));
  const reales = spvs.filter((s) => !isPlaceholderCompanyName(s.name));

  const inventadasIds = inventadas.map((s) => s.id);
  const realesIds = reales.map((s) => s.id);

  // Los proyectos que pierden su SPV. Se listan por nombre a propósito: son
  // proyectos reales y quien apruebe esto tiene que poder reconocerlos.
  const { data: proyectosRaw, error: projectError } = inventadasIds.length
    ? await client.from("project").select("id, name, verified_at").in("spv_id", inventadasIds)
    : { data: [], error: null };
  if (projectError) throw new Error(projectError.message);
  const proyectos = proyectosRaw ?? [];

  const { data: relacionesRaw } = spvs.length
    ? await client
        .from("entity_relationship")
        .select("*")
        .eq("source_type", "spv")
        .in(
          "source_id",
          spvs.map((s) => s.id),
        )
    : { data: [] };
  const relaciones = relacionesRaw ?? [];

  // Respaldo previo: nada de esto deja rastro después de borrarse.
  const logDir = join(repoRoot, "logs");
  mkdirSync(logDir, { recursive: true });
  const backup = join(logDir, "fix-template-spvs-backup.json");
  writeFileSync(
    backup,
    JSON.stringify({ empresasPlantilla: plantilla, spvs, proyectos, relaciones }, null, 2),
    "utf8",
  );

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    empresasPlantilla: plantilla.length,
    spvInventadasABorrar: inventadas.length,
    spvRealesASoltarMatriz: reales.map((s) => s.name),
    proyectosQuePierdenSpv: proyectos.length,
    proyectosVerificadosAfectados: proyectos.filter((p) => p.verified_at).length,
    relacionesABorrar: relaciones.length,
    backup,
  };

  if (apply) {
    // Orden obligado: soltar las referencias antes de borrar la fila apuntada,
    // o `project.spv_id` (ON DELETE NO ACTION) rechaza el delete — que es
    // exactamente como se descubrió este problema.
    if (proyectos.length) {
      const { error } = await client
        .from("project")
        .update({ spv_id: null })
        .in(
          "id",
          proyectos.map((p) => p.id),
        );
      if (error) throw new Error(`Soltando spv_id: ${error.message}`);
    }

    if (spvs.length) {
      const { error } = await client
        .from("entity_relationship")
        .delete()
        .eq("source_type", "spv")
        .in(
          "source_id",
          spvs.map((s) => s.id),
        );
      if (error) throw new Error(`Borrando relaciones: ${error.message}`);
    }

    if (inventadasIds.length) {
      const { error } = await client.from("spv").delete().in("id", inventadasIds);
      if (error) throw new Error(`Borrando SPV inventadas: ${error.message}`);
    }

    if (realesIds.length) {
      const { error } = await client.from("spv").update({ parent_company_id: null }).in("id", realesIds);
      if (error) throw new Error(`Soltando matriz de las SPV reales: ${error.message}`);
    }

    // Verificación de cierre: si queda una sola SPV colgando, el paso 3 vuelve
    // a chocar y no queremos enterarnos recién ahí.
    const { data: restantes } = await client.from("spv").select("id").in("parent_company_id", companyIds);
    Object.assign(resumen, { spvRestantesColgando: (restantes ?? []).length });
  }

  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
