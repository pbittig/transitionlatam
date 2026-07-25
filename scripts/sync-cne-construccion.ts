import { config } from "dotenv";
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const XLSX_PATH = join(__dirname, "..", "dataset", "proyectos-en-construccion.xlsx");

// La fuente guarda el CSV real (separado por ";") partido en varias celdas de
// Excel allí donde el texto original tenía una coma (ej. dentro de "9,0") —
// se reconstruye uniendo las celdas con "," antes de separar por ";". Además
// viene con mojibake (UTF-8 releído como Latin1) — se revierte igual que se
// hizo para inspeccionar el archivo.
function fixMojibake(s: string): string {
  return Buffer.from(s, "latin1").toString("utf8");
}

function rowToFields(values: unknown[], headerCount: number): string[] {
  const joined = values.filter((v) => v !== null && v !== undefined).join(",");
  const fields = fixMojibake(joined).split(";");
  // Asegura largo consistente aunque falten campos al final de la fila.
  while (fields.length < headerCount) fields.push("");
  return fields;
}

function parseChileanNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDdMmYyyy(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    throw new Error(`No se encontró ${XLSX_PATH}. Copia el archivo de CNE a dataset/proyectos-en-construccion.xlsx.`);
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(XLSX_PATH);
  const sheet = workbook.worksheets[0];

  const headerValues = sheet.getRow(1).values as unknown[];
  const headers = fixMojibake(headerValues.filter((v) => v != null).join(",")).split(";");

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = (sheet.getRow(r).values as unknown[]).filter((v) => v != null);
    if (values.length === 0) continue;
    const fields = rowToFields(values, headers.length);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = fields[i] ?? ""));
    rows.push(obj);
  }

  const numRes = rows[0]?.num_res;
  const fechaResRaw = rows[0]?.fecha_res;
  const fechaRes = fechaResRaw ? parseDdMmYyyy(fechaResRaw) : null;
  if (!numRes || !fechaRes) throw new Error(`No se pudo leer num_res/fecha_res (visto: "${numRes}" / "${fechaResRaw}")`);

  const { data: lastSync } = await client
    .from("cne_construccion_sync_log")
    .select("num_res, fecha_res")
    .order("fecha_res", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSync?.num_res === numRes) {
    console.log(`Sin cambios: la resolución vigente sigue siendo N° ${numRes} (${fechaRes}). No se reprocesa.`);
    return;
  }

  console.log(`Resolución N° ${numRes} del ${fechaRes}: ${rows.length} proyectos en construcción.`);

  const { error: deleteError } = await client.from("construction_project").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteError) throw new Error(`Error limpiando construction_project: ${deleteError.message}`);

  let totalPotencia = 0;
  const insertRows = rows.map((r) => {
    const potencia = parseChileanNumber(r.potencia_neta_mw) ?? 0;
    totalPotencia += potencia;
    return {
      proyecto_central: r.proyecto_central || "Sin nombre",
      proyecto_bess_asociado: r.proyecto_bess_asociado || null,
      propietario: r.propietario || null,
      tipo_tecnologia: r.tipo_tecnologia || null,
      tipo_tecnologia_final: r.tipo_tecnologia_final || null,
      categoria: r.categoria || null,
      potencia_neta_mw: potencia,
      capacidad_instalada_raw: r.capacidad_instalada_mw || null,
      barra_conexion: r.barra_conexion || null,
      res_original: r.res_original || null,
      fecha_original_interconexion: parseDdMmYyyy(r.fecha_original_interconexion || ""),
      fecha_estimada_interconexion: parseDdMmYyyy(r.fecha_estimada_interconexion || ""),
      region: r.region || null,
      num_res: numRes,
      fecha_res: fechaRes,
      synced_at: new Date().toISOString(),
    };
  });

  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < insertRows.length; i += BATCH) {
    const batch = insertRows.slice(i, i + BATCH);
    const { error } = await client.from("construction_project").insert(batch);
    if (error) throw new Error(`Error insertando lote ${i}: ${error.message}`);
    inserted += batch.length;
  }

  await client.from("cne_construccion_sync_log").insert({
    num_res: numRes,
    fecha_res: fechaRes,
    row_count: inserted,
    total_potencia_mw: totalPotencia,
  });

  console.log(`\nListo: ${inserted} proyectos en construcción cargados (Res. N° ${numRes}, ${fechaRes}).`);
  console.log(`Potencia neta total: ${Math.round(totalPotencia).toLocaleString("es-CL")} MW`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
