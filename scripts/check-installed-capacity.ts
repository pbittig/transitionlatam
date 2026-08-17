// Compara la capacidad instalada que publica el sitio contra la del archivo de la CNE.
//
// POR QUÉ EXISTE: durante semanas el sitio publicó 54.354 MW cuando el país
// tiene ~38.600. La causa fue que dos fuentes escribían en `power_plant` con
// claves que chocaban —la CNE inventaba `id_central` con un contador desde 1 y
// el Coordinador hacía upsert por esa misma columna con sus ids reales—, así
// que las centrales se duplicaban y 580 filas quedaban además cruzadas: la
// clave de una central con los datos de otra.
//
// Nadie lo detectó automáticamente. Lo notó el usuario mirando la portada. Este
// chequeo es para que la próxima vez lo diga la máquina.
//
// CÓMO COMPARA: `cne_capacidad_sync_log` guarda el total que traía cada archivo
// de la CNE. Ese es el número contra el que se contrasta lo que el sitio suma
// hoy. No se recalcula desde `power_plant` — comparar una tabla consigo misma
// no detectaría nada; la gracia es tener dos números de origen distinto.
//
// EL MARGEN es de 5%: la CNE lista capacidad instalada y el sitio suma solo las
// operativas, así que un desfase chico es normal y esperable. Un 40% no.
//
// Uso:
//   node_modules/.bin/tsx scripts/check-installed-capacity.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const JOB_NAME = "check-installed-capacity";
const MARGEN = 0.05;

async function main() {
  const client = createSupabaseServiceClient();
  const run = await startCronRun(client, JOB_NAME);

  try {
    const { data: ultimaCarga, error: logError } = await client
      .from("cne_capacidad_sync_log")
      .select("fecha_act, total_capacity_mw, row_count")
      .order("fecha_act", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (logError) throw new Error(logError.message);
    if (!ultimaCarga) throw new Error("No hay ninguna carga de la CNE registrada contra la cual comparar.");

    const { data: stats, error: statsError } = await client.rpc("get_power_plant_stats");
    if (statsError) throw new Error(statsError.message);
    const publicado = Number((stats as { operatingCapacityMw: number }).operatingCapacityMw);
    const referencia = Number(ultimaCarga.total_capacity_mw);
    const desvio = referencia > 0 ? Math.abs(publicado - referencia) / referencia : 1;

    const resumen = {
      publicadoMw: Math.round(publicado),
      cneMw: Math.round(referencia),
      archivoCne: ultimaCarga.fecha_act,
      desvio: `${(desvio * 100).toFixed(1)}%`,
      margen: `${MARGEN * 100}%`,
    };
    console.log(JSON.stringify(resumen, null, 2));

    const fuera = desvio > MARGEN;
    await finishCronRun(client, run, {
      status: fuera ? "error" : "success",
      eligible_rows: Math.round(publicado),
      error_message: fuera
        ? `El sitio publica ${Math.round(publicado).toLocaleString("es-CL")} MW y la CNE trae ${Math.round(referencia).toLocaleString("es-CL")} MW (${(desvio * 100).toFixed(1)}% de desvío).`
        : null,
      metadata: resumen,
    });

    if (fuera) {
      console.error("\nEl desvío supera el margen. Suele significar que una fuente está cargando centrales duplicadas.");
      process.exitCode = 1;
    }
  } catch (err) {
    await finishCronRun(client, run, { status: "error", error_message: (err as Error).message || "Error sin mensaje" });
    throw err;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
