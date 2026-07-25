import { config } from "dotenv";
import ExcelJS from "exceljs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(join(__dirname, "..", "dataset", "solicitudes_muestra.xlsx"));
  const sheet = workbook.worksheets[0];
  const header = Array.from(sheet.getRow(1).values as unknown[]).map((v) => String(v ?? "").trim());
  const idIdx = header.findIndex((h) => h === "Id");
  const nupIdx = header.findIndex((h) => h === "NUP");

  let updated = 0;
  let skippedEmpty = 0;
  let notFound = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const values = Array.from(sheet.getRow(r).values as unknown[]);
    if (values.filter((v) => v != null).length === 0) continue;
    const id = values[idIdx];
    const nup = values[nupIdx];
    if (!id) continue;
    if (nup === null || nup === undefined || String(nup).trim() === "") {
      skippedEmpty++;
      continue;
    }

    let lastError: string | null = null;
    let rows: { id: string }[] | null = null;
    for (let attempt = 1; attempt <= 3 && rows === null; attempt++) {
      const { data, error } = await client
        .from("project")
        .update({ nup: String(nup).trim() })
        .eq("external_reference", String(id))
        .select("id");
      if (!error) {
        rows = data;
        break;
      }
      lastError = error.message;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
    if (rows === null) throw new Error(`Error actualizando NUP para external_reference=${id}: ${lastError}`);
    if (rows.length === 0) {
      notFound++;
    } else {
      updated += rows.length;
    }
  }

  console.log(`Actualizados: ${updated} | sin NUP en origen: ${skippedEmpty} | external_reference no encontrado: ${notFound}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
