// Manda a revisión los proyectos que quedaron sin SPV al limpiar las sociedades
// que había inventado la plantilla del Formulario (ver `fix-template-spvs.ts`).
//
// POR QUÉ NO ALCANZA CON QUE ESTÉN SIN VERIFICAR: 26 de los 27 nunca se
// verificaron, así que ya estaban en la cola del Verificador — perdidos entre
// cientos. Sin una marca, nadie sabría que a estos les falta un dato concreto ni
// por qué está vacío, y el hueco se lee como "no había SPV" en vez de "la que
// había era falsa y hay que buscar la verdadera".
//
// QUÉ LISTA SE USA: los ids salen de `logs/fix-template-spvs-backup.json`, el
// respaldo que dejó la limpieza. No se re-derivan buscando proyectos sin SPV:
// hoy hay ~925 en esa condición y solo estos 27 la adquirieron por esta causa.
//
// NO toca `verified_at`. El único proyecto verificado del grupo conserva su
// verificación y aparece marcado; si hay que devolverlo a la cola completa, esa
// decisión es de quien revisa, con el botón que ya existe en la página.
//
// Uso:
//   node_modules/.bin/tsx scripts/flag-projects-missing-spv.ts           # simulación
//   node_modules/.bin/tsx scripts/flag-projects-missing-spv.ts --apply   # aplica
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

const REASON =
  "Se le quitó la sociedad vehículo el 2026-08-12: la que tenía era un nombre de relleno de la " +
  "plantilla del Formulario, no una sociedad real. Falta identificar la SPV verdadera — el " +
  "Formulario del proyecto es la fuente, y hoy se lee con el parser posicional, que funciona " +
  "mejor que cuando este proyecto se ingirió.";

interface BackupProject {
  id: string;
  name: string;
  verified_at: string | null;
}

async function main() {
  const backupPath = join(repoRoot, "logs", "fix-template-spvs-backup.json");
  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as { proyectos: BackupProject[] };
  const ids = backup.proyectos.map((p) => p.id);
  if (ids.length === 0) throw new Error(`${backupPath} no tiene proyectos. Abortado.`);

  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Se re-lee el estado actual en vez de confiar en el respaldo: si alguien ya
  // les asignó una SPV a mano, marcarlos sería mandar a revisar algo resuelto.
  const { data: actuales, error } = await client.from("project").select("id, name, spv_id, verified_at").in("id", ids);
  if (error) throw new Error(error.message);
  const encontrados = actuales ?? [];

  if (encontrados.length !== ids.length) {
    throw new Error(`Se esperaban ${ids.length} proyectos y la base devolvió ${encontrados.length}. Abortado.`);
  }

  const yaResueltos = encontrados.filter((p) => p.spv_id !== null);
  const aMarcar = encontrados.filter((p) => p.spv_id === null);

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    aMarcar: aMarcar.length,
    verificadosEnElGrupo: aMarcar.filter((p) => p.verified_at).map((p) => p.name),
    yaConSpvSeOmiten: yaResueltos.map((p) => p.name),
  };

  if (apply && aMarcar.length) {
    const { error: updateError } = await client
      .from("project")
      .update({ needs_reverification: true, reverification_reason: REASON })
      .in(
        "id",
        aMarcar.map((p) => p.id),
      );
    if (updateError) throw new Error(updateError.message);

    const { count } = await client
      .from("project")
      .select("id", { count: "exact", head: true })
      .eq("needs_reverification", true);
    Object.assign(resumen, { colaDeRevisionTotal: count ?? 0 });
  }

  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
