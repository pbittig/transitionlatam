// Fusiona parejas de empresas confirmadas a mano como la misma persona jurídica.
//
// POR QUÉ NO SIRVEN LOS OTROS DOS SCRIPTS: `merge-companies-by-rut.ts` agrupa
// filas que YA comparten RUT, y `merge-companies-by-name.ts` exige la misma
// razón social salvo formato. Estas parejas no cumplen ninguna de las dos: una
// fila tiene el RUT y la otra no, y los nombres son distintos ("Zelestra Chile
// SpA" y "Solarpack Chile Limitada"). Escribir el RUT en la fila que no lo
// tiene tampoco es opción: el índice `company_rut_normalized_unique_idx` lo
// rechaza mientras la otra siga existiendo.
//
// DE DÓNDE SALE LA CERTEZA. Cada pareja tiene DOS evidencias independientes:
//
//  1. La fuente ya las daba con el MISMO RUT: la fusión por RUT del 2026-08-16
//     las unió bajo ese criterio (ver logs/merge-companies-by-rut-backup.json).
//     La fila sin RUT reapareció después, al reingestar el listado.
//  2. Búsqueda externa del usuario (2026-08-18), que confirmó el mismo RUT.
//
// Dos de ellas son además cambios de marca conocidos y documentados en el
// repo: Solarpack→Zelestra y, en la misma familia, AES Gener→AES Andes.
//
// CUÁL SOBREVIVE: la fila que YA tiene el RUT verificado, aunque tenga menos
// proyectos. Es la expresión directa de "el RUT manda": esa fila es la que está
// identificada legalmente, y es la que la fusión de agosto había dejado en pie.
//
// Uso:
//   node_modules/.bin/tsx scripts/merge-companies-verified-pairs.ts           # simulación
//   node_modules/.bin/tsx scripts/merge-companies-verified-pairs.ts --apply   # aplica
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

/**
 * `absorbe` es el nombre exacto de la fila que desaparece; `rut` identifica a
 * la que queda. `renombrarA` se usa cuando la fila que sobrevive quedó con la
 * razón social anterior a un cambio de marca: el RUT fija la identidad, pero
 * el nombre que se muestra debe ser el vigente. El anterior no se pierde —
 * queda como alias.
 */
const PAREJAS: Array<{ rut: string; absorbe: string[]; nota: string; renombrarA?: string }> = [
  {
    rut: "76.412.562-2",
    absorbe: ["Enel Green Power del Sur ", "Enel Green power"],
    nota: "la fuente les daba el mismo RUT; fusionadas ya el 2026-08-16",
  },
  {
    rut: "76.041.002-0",
    absorbe: ["Zelestra Chile SpA", "Zelestra Chile SpA (Antes Solarpack Chile Ltda)"],
    nota: "cambio de marca Solarpack→Zelestra, declarado en el propio nombre de una de las filas",
    renombrarA: "Zelestra Chile SpA",
  },
  {
    rut: "76.264.224-7",
    absorbe: ["Verano Capital Holding SpA"],
    nota: "la fuente les daba el mismo RUT; fusionadas ya el 2026-08-16",
  },
  {
    rut: "77.244.808-2",
    absorbe: ["Fontus SCL III SpA"],
    nota: "el prefijo 'Fontus' es variante de nombre — confirmado por RUT en el par SCL I / Fontus SCL I",
  },
  {
    rut: "77.686.470-6",
    absorbe: ["Inversiones Bosquemar Limitada"],
    nota: "la fuente les daba el mismo RUT; fusionadas ya el 2026-08-16",
  },
  // Confirmadas por el usuario el 2026-08-18: el RUT ya estaba en la base, en
  // una fila hermana, y la que traía la cartera había quedado sin identidad.
  {
    rut: "76.874.669-9",
    absorbe: ["Free Power SpA"],
    nota: "confirmado por el usuario: misma sociedad, nombre corto de la razón social completa",
  },
  {
    rut: "76.540.957-8",
    absorbe: ["Trina Solar Systems SpA.", "Trina Solar Sysmtes (Chile) SpA"],
    nota: "confirmado por el usuario; la tercera fila es una errata de tipeo del mismo nombre",
  },
  {
    rut: "76.188.197-3",
    absorbe: ["Bioenergías Forestales SpA"],
    nota: "confirmado por el usuario: 'Bionergias' es una errata de 'Bioenergías'",
    // Sobrevive la fila del RUT, que es justamente la que tiene el nombre mal
    // escrito: se le devuelve la ortografía correcta.
    renombrarA: "Bioenergías Forestales SpA",
  },
];

const normalizarRut = (rut: string) => rut.toUpperCase().replace(/[^0-9K]/g, "");

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
  // Las de abajo no tienen llave foránea: nadie avisa si uno se las olvida.
  await mover("entity_relationship(origen)", "entity_relationship", { source_type: "company", source_id: desdeId }, { source_id: haciaId });
  await mover("entity_relationship(destino)", "entity_relationship", { target_type: "company", target_id: desdeId }, { target_id: haciaId });
  await mover("entity_alias", "entity_alias", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  await mover("data_attribution", "data_attribution", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  return movidos;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await client.from("company").select("id, name, rut").limit(5000);
  if (error) throw new Error(error.message);
  const empresas = (data ?? []) as Array<{ id: string; name: string; rut: string | null }>;

  const plan: Array<Record<string, unknown>> = [];
  for (const pareja of PAREJAS) {
    const objetivo = empresas.find((e) => e.rut && normalizarRut(e.rut) === normalizarRut(pareja.rut));
    if (!objetivo) {
      console.log(`AVISO: no existe empresa con RUT ${pareja.rut} — se omite la pareja.`);
      continue;
    }
    const absorbidas = pareja.absorbe
      .map((nombre) => empresas.find((e) => e.name === nombre && e.id !== objetivo.id))
      .filter((e): e is { id: string; name: string; rut: string | null } => !!e);

    for (const a of absorbidas) {
      if (a.rut && normalizarRut(a.rut) !== normalizarRut(pareja.rut)) {
        throw new Error(`"${a.name}" tiene RUT propio distinto (${a.rut}) — no se fusiona a ciegas.`);
      }
    }
    if (absorbidas.length === 0) continue;

    plan.push({
      rut: pareja.rut,
      nota: pareja.nota,
      renombrarA: pareja.renombrarA && pareja.renombrarA !== objetivo.name ? pareja.renombrarA : null,
      sobrevive: { id: objetivo.id, name: objetivo.name, referencias: await contarReferencias(client, objetivo.id) },
      absorbidas: await Promise.all(
        absorbidas.map(async (a) => ({ id: a.id, name: a.name, referencias: await contarReferencias(client, a.id) })),
      ),
    });
  }

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    parejas: plan.length,
    empresasQueDesaparecen: plan.reduce((n, g) => n + (g.absorbidas as unknown[]).length, 0),
    referenciasAMover: plan.reduce(
      (n, g) => n + (g.absorbidas as Array<{ referencias: number }>).reduce((s, a) => s + a.referencias, 0),
      0,
    ),
  };

  if (!apply) {
    console.log(JSON.stringify(resumen, null, 2));
    for (const g of plan) {
      const s = g.sobrevive as { name: string; referencias: number };
      const a = g.absorbidas as Array<{ name: string; referencias: number }>;
      console.log(`\n  ${g.rut}  (${g.nota})`);
      console.log(`     queda:  ${s.name} (${s.referencias} refs)`);
      console.log(`     se van: ${a.map((x) => `${x.name} (${x.referencias})`).join(" | ")}`);
    }
    console.log("\nCorrer con --apply para ejecutar.");
    return;
  }

  mkdirSync(join(repoRoot, "logs"), { recursive: true });
  writeFileSync(join(repoRoot, "logs", "merge-companies-verified-pairs-backup.json"), JSON.stringify(plan, null, 2), "utf8");

  const movidosTotales: Record<string, number> = {};
  for (const g of plan) {
    const objetivo = g.sobrevive as { id: string };
    for (const a of g.absorbidas as Array<{ id: string; name: string }>) {
      const movidos = await repuntar(client, a.id, objetivo.id);
      for (const [k, v] of Object.entries(movidos)) movidosTotales[k] = (movidosTotales[k] ?? 0) + v;
      await client.from("entity_alias").insert({ entity_type: "company", entity_id: objetivo.id, alias: a.name });
      const { error: borrarError } = await client.from("company").delete().eq("id", a.id);
      if (borrarError) throw new Error(`No se pudo borrar ${a.name}: ${borrarError.message}`);
    }
    // El rename va DESPUÉS de borrar: el nombre nuevo suele ser justamente el
    // de una de las filas absorbidas, y chocaría mientras siga existiendo.
    const nuevoNombre = g.renombrarA as string | null;
    if (nuevoNombre) {
      const anterior = (g.sobrevive as { name: string }).name;
      await client.from("entity_alias").insert({ entity_type: "company", entity_id: objetivo.id, alias: anterior });
      const { error: renombrarError } = await client.from("company").update({ name: nuevoNombre }).eq("id", objetivo.id);
      if (renombrarError) throw new Error(`No se pudo renombrar a ${nuevoNombre}: ${renombrarError.message}`);
    }
  }

  Object.assign(resumen, { referenciasMovidas: movidosTotales, respaldo: "logs/merge-companies-verified-pairs-backup.json" });
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
