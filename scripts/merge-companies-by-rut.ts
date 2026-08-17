// Fusiona las empresas que comparten RUT, dejando una sola por persona jurídica.
//
// POR QUÉ HAY DUPLICADOS: el índice `company_rut_unique_idx` compara el texto
// crudo, y el mismo RUT convive escrito de tres formas — "77.177.065-7",
// "77177065-7", "771770657". Los duplicados se le escapan por el formato.
// Medido el 2026-08-16: 51 grupos, 52 filas de más.
//
// EL CRITERIO ES EL RUT, NO EL NOMBRE (decisión del usuario, 2026-08-16). En
// Chile el RUT identifica a UNA persona jurídica, así que dos filas que lo
// comparten son la misma empresa aunque se llamen distinto: "Atacama Solar
// S.A." y "Atacama Solar SpA" son una, y "JINKO POWER CHILE III SPA" y "IV SPA"
// también — si comparten RUT, el nombre es lo que está mal, no el RUT.
//
// CUÁL SOBREVIVE: la fila con más cosas colgando (proyectos + relaciones +
// atribuciones). Es la que menos referencias hay que mover y la que más
// probablemente tiene la ficha trabajada. A igualdad, gana la más antigua. El
// RUT del sobreviviente se normaliza a "12.345.678-9" para que el índice
// empiece a servir de algo.
//
// QUÉ SE MUEVE ANTES DE BORRAR: todo lo que apunta a company —project,
// opportunity, spv.parent_company_id, company_shareholding (las dos columnas),
// schedule_calibration_stat— más lo que la referencia sin llave foránea:
// entity_relationship (source/target), entity_alias y data_attribution. Esos
// tres son los que no avisan si uno se olvida: no hay FK que los proteja, así
// que un borrado los dejaría apuntando a un id inexistente.
//
// El nombre del duplicado se guarda como alias del sobreviviente: es como la
// fuente lo llamó alguna vez y sirve para volver a cruzarlo.
//
// Uso:
//   node_modules/.bin/tsx scripts/merge-companies-by-rut.ts           # simulación
//   node_modules/.bin/tsx scripts/merge-companies-by-rut.ts --apply   # aplica
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeRutDigits } from "../lib/ingestion/sources/sea-pertinencia/matching";

const apply = process.argv.includes("--apply");

interface Empresa {
  id: string;
  name: string;
  rut: string;
  legal_address: string | null;
  created_at: string;
}

/** "771770657" -> "77.177.065-7". El dígito verificador puede ser K. */
function formatoCanonico(rutNormalizado: string): string {
  const cuerpo = rutNormalizado.slice(0, -1);
  const dv = rutNormalizado.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

async function contarReferencias(client: SupabaseClient, companyId: string): Promise<number> {
  const conteos = await Promise.all([
    client.from("project").select("id", { count: "exact", head: true }).eq("developer_company_id", companyId),
    client.from("opportunity").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    client.from("spv").select("id", { count: "exact", head: true }).eq("parent_company_id", companyId),
    client.from("entity_relationship").select("id", { count: "exact", head: true }).eq("source_type", "company").eq("source_id", companyId),
    client.from("entity_relationship").select("id", { count: "exact", head: true }).eq("target_type", "company").eq("target_id", companyId),
    client.from("data_attribution").select("id", { count: "exact", head: true }).eq("entity_type", "company").eq("entity_id", companyId),
  ]);
  return conteos.reduce((suma, r) => suma + (r.count ?? 0), 0);
}

/** Mueve TODO lo que apunta a `desdeId` hacia `haciaId`. Sin esto, borrar deja huérfanos. */
async function repuntar(client: SupabaseClient, desdeId: string, haciaId: string): Promise<Record<string, number>> {
  const movidos: Record<string, number> = {};
  const mover = async (etiqueta: string, tabla: string, filtro: Record<string, string>, patch: Record<string, string>) => {
    // El count va en `update`, no en `select`: el builder de update no acepta
    // opciones en select y devolvería el conteo en silencio como undefined.
    let q = client.from(tabla).update(patch, { count: "exact" });
    for (const [col, val] of Object.entries(filtro)) q = q.eq(col, val);
    const { error, count } = await q;
    if (error) throw new Error(`${etiqueta}: ${error.message}`);
    if (count) movidos[etiqueta] = (movidos[etiqueta] ?? 0) + count;
  };

  await mover("project", "project", { developer_company_id: desdeId }, { developer_company_id: haciaId });
  await mover("opportunity", "opportunity", { company_id: desdeId }, { company_id: haciaId });
  await mover("spv", "spv", { parent_company_id: desdeId }, { parent_company_id: haciaId });
  await mover("schedule_calibration_stat", "schedule_calibration_stat", { developer_company_id: desdeId }, { developer_company_id: haciaId });
  await mover("company_shareholding(company)", "company_shareholding", { company_id: desdeId }, { company_id: haciaId });
  await mover("company_shareholding(accionista)", "company_shareholding", { shareholder_company_id: desdeId }, { shareholder_company_id: haciaId });
  // Las tres de abajo no tienen llave foránea: nadie avisa si se olvidan.
  await mover("entity_relationship(origen)", "entity_relationship", { source_type: "company", source_id: desdeId }, { source_id: haciaId });
  await mover("entity_relationship(destino)", "entity_relationship", { target_type: "company", target_id: desdeId }, { target_id: haciaId });
  await mover("entity_alias", "entity_alias", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  await mover("data_attribution", "data_attribution", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  return movidos;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await client.from("company").select("id, name, rut, legal_address, created_at").not("rut", "is", null);
  if (error) throw new Error(error.message);
  const empresas = (data ?? []) as Empresa[];

  const porRut = new Map<string, Empresa[]>();
  for (const e of empresas) {
    const clave = normalizeRutDigits(e.rut);
    if (!clave) continue;
    if (!porRut.has(clave)) porRut.set(clave, []);
    porRut.get(clave)!.push(e);
  }
  const grupos = [...porRut.entries()].filter(([, filas]) => filas.length > 1);

  const plan: Array<Record<string, unknown>> = [];
  for (const [rut, filas] of grupos) {
    const conReferencias = await Promise.all(
      filas.map(async (f) => ({ ...f, referencias: await contarReferencias(client, f.id) })),
    );
    // Sobrevive la que más arrastra; a igualdad, la más antigua.
    conReferencias.sort((a, b) => b.referencias - a.referencias || a.created_at.localeCompare(b.created_at));
    const [ganadora, ...absorbidas] = conReferencias;
    plan.push({
      rut: formatoCanonico(rut),
      sobrevive: { id: ganadora.id, name: ganadora.name, rutGuardado: ganadora.rut, referencias: ganadora.referencias },
      absorbidas: absorbidas.map((a) => ({ id: a.id, name: a.name, rutGuardado: a.rut, referencias: a.referencias })),
    });
  }

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    grupos: plan.length,
    empresasQueDesaparecen: plan.reduce((n, g) => n + (g.absorbidas as unknown[]).length, 0),
    referenciasAMover: plan.reduce(
      (n, g) => n + (g.absorbidas as Array<{ referencias: number }>).reduce((s, a) => s + a.referencias, 0),
      0,
    ),
  };

  if (!apply) {
    console.log(JSON.stringify(resumen, null, 2));
    console.log("\nPrimeros grupos:");
    for (const g of plan.slice(0, 8)) {
      const s = g.sobrevive as { name: string; referencias: number };
      const a = g.absorbidas as Array<{ name: string; referencias: number }>;
      console.log(`  ${g.rut}\n     queda: ${s.name} (${s.referencias} refs)\n     se van: ${a.map((x) => `${x.name} (${x.referencias})`).join(" | ")}`);
    }
    console.log(`\n... y ${Math.max(0, plan.length - 8)} grupos más. Correr con --apply para ejecutar.`);
    return;
  }

  mkdirSync(join(repoRoot, "logs"), { recursive: true });
  writeFileSync(join(repoRoot, "logs", "merge-companies-by-rut-backup.json"), JSON.stringify(plan, null, 2), "utf8");

  const movidosTotales: Record<string, number> = {};
  for (const g of plan) {
    const ganadora = g.sobrevive as { id: string };
    for (const absorbida of g.absorbidas as Array<{ id: string; name: string }>) {
      const movidos = await repuntar(client, absorbida.id, ganadora.id);
      for (const [k, v] of Object.entries(movidos)) movidosTotales[k] = (movidosTotales[k] ?? 0) + v;
      // El nombre del duplicado se conserva como alias: es como la fuente lo
      // llamó, y sirve para volver a cruzarlo más adelante.
      await client.from("entity_alias").insert({ entity_type: "company", entity_id: ganadora.id, alias: absorbida.name });
      const { error: borrarError } = await client.from("company").delete().eq("id", absorbida.id);
      if (borrarError) throw new Error(`No se pudo borrar ${absorbida.name}: ${borrarError.message}`);
    }
    const { error: rutError } = await client.from("company").update({ rut: g.rut as string }).eq("id", ganadora.id);
    if (rutError) throw new Error(`No se pudo normalizar el RUT ${g.rut}: ${rutError.message}`);
  }

  Object.assign(resumen, { referenciasMovidas: movidosTotales, respaldo: "logs/merge-companies-by-rut-backup.json" });
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
