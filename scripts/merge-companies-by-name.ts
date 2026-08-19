// Fusiona las empresas que son la MISMA razón social escrita distinto.
//
// POR QUÉ HAY DUPLICADOS: `merge-companies-by-rut.ts` (2026-08-16) unió las que
// compartían RUT, pero la mayoría de las filas no tiene RUT y quedaron sueltas.
// Lo que sobrevive son variantes de tipeo de un mismo nombre: espacio al final,
// punto de más, tilde, mayúsculas. Medido el 2026-08-18: 22 empresas tienen la
// cartera partida en dos o más filas —Colbún aparece con 40 proyectos en una
// fila y 4 en otra— así que la ficha de Propietarios muestra menos cartera de
// la que la empresa realmente tiene.
//
// EL CRITERIO ES LA RAZÓN SOCIAL EXACTA, NO EL PARECIDO. Dos filas se fusionan
// solo si, después de sacar tildes, puntuación, mayúsculas y espacios de más,
// queda EXACTAMENTE el mismo texto Y la misma forma jurídica. Es decir:
//
//   SÍ:  "Colbún S.A." = "Colbún S.A" = "COLBUN SA"        (solo formato)
//   SÍ:  "Engie Energía Chile" → "Engie Energía Chile S.A." (una sin forma, y
//                                                            el grupo tiene una
//                                                            sola forma posible)
//   NO:  "Orion Power S.A." vs "Orion Power SpA"   (S.A. y SpA son personas
//                                                   jurídicas distintas)
//   NO:  "GRENERGY RENOVABLES PACIFIC" vs "GRENERGY PACIFIC"  (otro nombre)
//   NO:  "GRENERGY RENEVABLES PACIFIC"  (errata: se avisa, no se adivina)
//
// Lo que queda fuera sigue apareciendo en el aviso de "empresas con nombre
// parecido" de Propietarios, que para eso está: sin RUT no se puede afirmar que
// una Ltda y una SpA con el mismo nombre sean la misma persona jurídica, y atar
// empresas equivocadas cuesta más que mostrarlas separadas.
//
// RUT EN CONFLICTO = NO SE TOCA. Si dos filas del grupo tienen RUT distintos,
// son dos personas jurídicas y el grupo se descarta entero, aunque se llamen
// igual.
//
// CUÁL SOBREVIVE: la fila con más cosas colgando (misma regla que el merge por
// RUT); a igualdad, la más antigua. Si el grupo tiene un único RUT y quedó en
// una fila absorbida, se le traspasa al sobreviviente: es la identidad legal y
// no se pierde.
//
// QUÉ SE MUEVE ANTES DE BORRAR: lo mismo que en el merge por RUT — project,
// opportunity, spv, schedule_calibration_stat, company_shareholding (sus dos
// columnas) y las tres tablas sin llave foránea (entity_relationship,
// entity_alias, data_attribution), que son las que no avisan si uno se olvida.
//
// Uso:
//   node_modules/.bin/tsx scripts/merge-companies-by-name.ts           # simulación
//   node_modules/.bin/tsx scripts/merge-companies-by-name.ts --apply   # aplica
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
  rut: string | null;
  created_at: string;
}

/** Formas jurídicas que se reconocen. Cada variante de tipeo cae en una sola clave. */
const FORMAS: Array<{ forma: string; patrones: RegExp }> = [
  { forma: "spa", patrones: /^(spa|s p a)$/ },
  { forma: "sa", patrones: /^(sa|s a)$/ },
  { forma: "ltda", patrones: /^(ltda|limitada|lda)$/ },
  { forma: "eirl", patrones: /^(eirl|e i r l)$/ },
  { forma: "srl", patrones: /^(srl|s r l)$/ },
  { forma: "inc", patrones: /^(inc|llc|corp)$/ },
];

/**
 * Parte el nombre en núcleo + forma jurídica.
 *
 * El núcleo se compara con tolerancia solo al FORMATO (tildes, mayúsculas,
 * puntuación, espacios). No hay tolerancia a erratas: "RENEVABLES" y
 * "RENOVABLES" son núcleos distintos, y eso es a propósito — corregir una
 * errata es adivinar, y adivinar mal fusiona dos empresas que no lo son.
 */
function partir(nombre: string): { nucleo: string; forma: string | null } {
  const plano = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const palabras = plano.split(" ").filter(Boolean);
  let forma: string | null = null;

  // La forma jurídica va al final. Se prueban las dos últimas palabras porque
  // "s a" y "s p a" quedan partidas al sacar los puntos.
  for (const largo of [3, 2, 1]) {
    if (palabras.length <= largo) continue;
    const cola = palabras.slice(-largo).join(" ");
    const encontrada = FORMAS.find((f) => f.patrones.test(cola));
    if (encontrada) {
      forma = encontrada.forma;
      palabras.splice(-largo, largo);
      break;
    }
  }

  return { nucleo: palabras.join(" "), forma };
}

/**
 * "762579131" -> "76.257.913-1". El RUT del grupo llega normalizado a dígitos
 * (así se compara), pero en la base se guarda en el formato canónico, igual que
 * lo dejó `merge-companies-by-rut.ts`: es el que la ficha muestra y el que hace
 * legible la columna al mirarla directo en la base.
 */
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
  await mover("entity_relationship(origen)", "entity_relationship", { source_type: "company", source_id: desdeId }, { source_id: haciaId });
  await mover("entity_relationship(destino)", "entity_relationship", { target_type: "company", target_id: desdeId }, { target_id: haciaId });
  await mover("entity_alias", "entity_alias", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  await mover("data_attribution", "data_attribution", { entity_type: "company", entity_id: desdeId }, { entity_id: haciaId });
  return movidos;
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await client.from("company").select("id, name, rut, created_at").limit(5000);
  if (error) throw new Error(error.message);
  const empresas = (data ?? []) as Empresa[];

  // Se agrupa por núcleo Y forma jurídica: "Orion Power S.A." y "Orion Power
  // SpA" comparten núcleo pero son dos personas jurídicas, así que van a cubos
  // distintos y cada cubo se fusiona por su cuenta. Agrupar solo por núcleo y
  // descartar el grupo entero cuando aparecían dos formas dejaba sin consolidar
  // casos que sí son inequívocos: las tres filas "Grenergy Renovables Pacific
  // Ltda(.)/Limitada" son la misma sociedad aunque al lado exista una SpA.
  const porClave = new Map<string, Empresa[]>();
  /** Filas sin forma jurídica en el nombre, para resolverlas después. */
  const sinForma = new Map<string, Empresa[]>();
  for (const e of empresas) {
    const { nucleo, forma } = partir(e.name);
    if (!nucleo) continue;
    const destino = forma === null ? sinForma : porClave;
    const clave = forma === null ? nucleo : `${nucleo}|${forma}`;
    if (!destino.has(clave)) destino.set(clave, []);
    destino.get(clave)!.push(e);
  }

  const descartados: Array<{ nucleo: string; motivo: string; filas: string[] }> = [];

  // Una fila sin forma jurídica ("Engie Energía Chile") solo se puede asignar
  // si el núcleo tiene UNA sola forma posible. Si conviven S.A. y SpA, no hay
  // manera de saber a cuál pertenece: se deja aparte.
  for (const [nucleo, filas] of sinForma) {
    const candidatas = [...porClave.keys()].filter((k) => k.startsWith(`${nucleo}|`));
    if (candidatas.length === 1) {
      porClave.get(candidatas[0])!.push(...filas);
    } else if (candidatas.length === 0 && filas.length > 1) {
      porClave.set(nucleo, filas);
    } else if (candidatas.length > 1) {
      descartados.push({
        nucleo,
        motivo: `sin forma jurídica y el núcleo tiene varias (${candidatas.map((c) => c.split("|")[1]).join(", ")})`,
        filas: filas.map((f) => f.name),
      });
    }
  }

  const plan: Array<Record<string, unknown>> = [];

  for (const [clave, filas] of porClave) {
    if (filas.length < 2) continue;
    const nucleo = clave.split("|")[0];
    const formas = new Set(filas.map((f) => partir(f.name).forma).filter((f): f is string => f !== null));

    const ruts = new Set(filas.map((f) => (f.rut ? normalizeRutDigits(f.rut) : null)).filter((r): r is string => !!r));
    if (ruts.size > 1) {
      descartados.push({ nucleo, motivo: `RUT distintos (${[...ruts].join(", ")})`, filas: filas.map((f) => f.name) });
      continue;
    }

    const conReferencias = await Promise.all(
      filas.map(async (f) => ({ ...f, referencias: await contarReferencias(client, f.id) })),
    );
    conReferencias.sort((a, b) => b.referencias - a.referencias || a.created_at.localeCompare(b.created_at));
    const [ganadora, ...absorbidas] = conReferencias;

    plan.push({
      nucleo,
      forma: [...formas][0] ?? "sin forma jurídica",
      // El RUT del grupo, si lo hay, se traspasa al sobreviviente: es la
      // identidad legal y no se pierde por quedar en la fila absorbida.
      rutFinal: ruts.size === 1 ? formatoCanonico([...ruts][0]) : null,
      sobrevive: { id: ganadora.id, name: ganadora.name, rut: ganadora.rut, referencias: ganadora.referencias },
      absorbidas: absorbidas.map((a) => ({ id: a.id, name: a.name, rut: a.rut, referencias: a.referencias })),
    });
  }

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    gruposAFusionar: plan.length,
    empresasQueDesaparecen: plan.reduce((n, g) => n + (g.absorbidas as unknown[]).length, 0),
    referenciasAMover: plan.reduce(
      (n, g) => n + (g.absorbidas as Array<{ referencias: number }>).reduce((s, a) => s + a.referencias, 0),
      0,
    ),
    gruposDescartados: descartados.length,
  };

  if (!apply) {
    console.log(JSON.stringify(resumen, null, 2));
    console.log("\n=== SE FUSIONAN ===");
    for (const g of plan) {
      const s = g.sobrevive as { name: string; referencias: number };
      const a = g.absorbidas as Array<{ name: string; referencias: number }>;
      console.log(`  queda: ${s.name} (${s.referencias} refs)   ←   ${a.map((x) => `${x.name} (${x.referencias})`).join(" | ")}`);
    }
    console.log("\n=== NO SE TOCAN (siguen apareciendo en el aviso) ===");
    for (const d of descartados) console.log(`  ${d.motivo}: ${d.filas.join(" | ")}`);
    console.log("\nCorrer con --apply para ejecutar.");
    return;
  }

  mkdirSync(join(repoRoot, "logs"), { recursive: true });
  writeFileSync(join(repoRoot, "logs", "merge-companies-by-name-backup.json"), JSON.stringify(plan, null, 2), "utf8");

  const movidosTotales: Record<string, number> = {};
  for (const g of plan) {
    const ganadora = g.sobrevive as { id: string; rut: string | null };
    for (const absorbida of g.absorbidas as Array<{ id: string; name: string }>) {
      const movidos = await repuntar(client, absorbida.id, ganadora.id);
      for (const [k, v] of Object.entries(movidos)) movidosTotales[k] = (movidosTotales[k] ?? 0) + v;
      await client.from("entity_alias").insert({ entity_type: "company", entity_id: ganadora.id, alias: absorbida.name });
      const { error: borrarError } = await client.from("company").delete().eq("id", absorbida.id);
      if (borrarError) throw new Error(`No se pudo borrar ${absorbida.name}: ${borrarError.message}`);
    }
    // El RUT se escribe DESPUÉS de borrar: si estaba en una fila absorbida, el
    // índice único lo rechazaría mientras esa fila siga existiendo.
    if (g.rutFinal && !ganadora.rut) {
      const { error: rutError } = await client.from("company").update({ rut: g.rutFinal as string }).eq("id", ganadora.id);
      if (rutError) throw new Error(`No se pudo traspasar el RUT ${g.rutFinal}: ${rutError.message}`);
    }
  }

  Object.assign(resumen, { referenciasMovidas: movidosTotales, respaldo: "logs/merge-companies-by-name-backup.json" });
  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
