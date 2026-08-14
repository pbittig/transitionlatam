// Saca de la cola de revisión los proyectos sin SPV que además están caídos.
//
// POR QUÉ: `flag-projects-missing-spv.ts` marcó 27 proyectos por una sola
// condición —"la SPV que tenía era de plantilla"— y nunca miró el estado. 18 de
// esos 27 están Rechazados o Desistidos. Buscarle la sociedad vehículo
// verdadera a un proyecto muerto es trabajo que no se va a usar: desde el
// 2026-08-13 esos proyectos ni siquiera se le muestran al cliente (ver
// `20260813000000_restrict_project_visibility.sql`); viven en /admin/boveda.
//
// QUÉ NO TOCA: los que siguen vivos conservan la marca y su motivo, que es el
// trabajo que sí vale. Tampoco toca `verified_at` de nadie, ni los 5 proyectos
// que llegaron a la cola por el otro camino (cambio sospechoso de estado) —
// esos se filtran por el texto del motivo, no por el estado, porque ahí un
// proyecto que pasó a rechazado es justamente lo que hay que confirmar.
//
// REVERSIBLE: volver a marcarlos es correr `flag-projects-missing-spv.ts
// --apply`, que re-lee el respaldo y vuelve a poner marca y motivo.
//
// Uso:
//   node_modules/.bin/tsx scripts/unflag-dead-spv-projects.ts           # simulación
//   node_modules/.bin/tsx scripts/unflag-dead-spv-projects.ts --apply   # aplica
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";
import { ESTADOS_CAIDOS } from "../lib/data-access/projects";

const apply = process.argv.includes("--apply");

// El mismo prefijo que escribe flag-projects-missing-spv.ts. Se filtra por el
// motivo y no por "está sin SPV" para no arrastrar a los ~925 proyectos que
// están sin sociedad vehículo por causas normales.
const MOTIVO_SPV = "Se le quitó la sociedad vehículo";

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data, error } = await client
    .from("project")
    .select("id, name, status, reverification_reason")
    .eq("needs_reverification", true)
    .like("reverification_reason", `${MOTIVO_SPV}%`)
    .in("status", [...ESTADOS_CAIDOS]);
  if (error) throw new Error(error.message);

  const muertos = data ?? [];
  const resumen: Record<string, unknown> = {
    mode: apply ? "apply" : "dry-run",
    aDesmarcar: muertos.length,
    porEstado: muertos.reduce<Record<string, number>>((acc, p) => {
      const key = p.status ?? "sin estado";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };

  if (apply && muertos.length) {
    const { error: updateError } = await client
      .from("project")
      .update({ needs_reverification: false, reverification_reason: null })
      .in(
        "id",
        muertos.map((p) => p.id),
      );
    if (updateError) throw new Error(updateError.message);

    const { count } = await client
      .from("project")
      .select("id", { count: "exact", head: true })
      .eq("needs_reverification", true);
    resumen.colaDeRevisionTotal = count ?? 0;
  }

  console.log(JSON.stringify(resumen, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
