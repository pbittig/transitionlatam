import { config } from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { utmToLatLng, parseChileanNumber } from "../lib/ingestion/sources/sipub/shared/utm";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const CSV_PATH = join(__dirname, "..", "dataset", "se_capacidad_instalada_gx.csv");

// TODO (hallazgo pendiente de terminar): este CSV se puede automatizar igual
// que se hizo con el listado (ver lib/ingestion/sources/energia-abierta/listado/fetchFromApi.ts).
// Energía Abierta expone una API pública (WSO2 API Manager) con un apikey
// embebido en el JS del visualizador público, sin login:
//   Origen: http://energiaabierta.cl/visualizaciones/capacidad-instalada/
//     → iframe http://energiaabierta.cl/VizCNE/VIZ/VZ2/
//     → js/VizCNE.js trae el header `apikey: <JWT>` hardcodeado
//   Endpoint probado y funcional:
//     https://apim.ea.cne.cl:8244/capacidad_instalada/v1/gx/sistema?page=1&limit=1000000&sistema=SEN&estado=En%20Operacion
//     (repetir con sistema=SEA y sistema=SEM)
//   Devuelve: central, estado, tipo_final_energia, potencia_bruta_mw, potencia_neta_mw, fecha_act, sitema, subsistema
//   FALTA en esa respuesta (y SÍ está en este CSV): propietario, razón_social,
//   región/comuna, coordenadas UTM — o hay que buscar otro endpoint bajo el
//   mismo apikey (la suscripción incluye ~25 datasets más de Energía Abierta,
//   ver el JWT decodificado — "comuna_energetica", "proyectos_en_construccion",
//   "proyectos_sea", etc., todos potencialmente relevantes para este proyecto)
//   o cruzar esos campos desde otra fuente ya integrada (ej. sipub).
//   El apikey es de un plan "PRODUCTION"/"Unlimited" embebido públicamente en
//   el sitio — no es un secreto de este proyecto, es el mismo que usa
//   cualquier visitante del dashboard público.

// CNE reporta a nivel de tecnología específica (tipo_de_energia) — se agrupa
// en las mismas 5 categorías que ya usa el resto de la app (BarList,
// TechChipFilter — ver app/(public)/components/techChips.ts).
const PLANT_TYPE_MAP: Record<string, string> = {
  "Solar": "Solares",
  "Solar-CSP": "Solares",
  "Solar Fotovoltaica": "Solares",
  "Eólica": "Eólicas",
  "Hidráulica Embalse": "Hidroeléctricas",
  "Hidráulica Pasada": "Hidroeléctricas",
  "Mini Hidráulica Pasada": "Hidroeléctricas",
  "Geotérmica": "Geotérmica",
};
function mapPlantType(tipoDeEnergia: string): string {
  return PLANT_TYPE_MAP[tipoDeEnergia] ?? "Termoeléctricas";
}

function parseDdMmYyyy(input: string): string | null {
  const m = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

interface CneRow {
  sistema: string;
  central: string;
  propietario: string;
  razon_social: string;
  estado: string;
  clasificacion: string;
  region_nombre: string;
  comuna_nombre: string;
  tipo_de_energia: string;
  potencia_bruta_mw: string;
  potencia_neta_mw: string;
  coord_este_utm: string;
  coord_norte_utm: string;
  huso_utm: string;
  fecha_act: string;
}

function parseCsv(raw: string): CneRow[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const headers = lines[0].split(";");
  return lines.slice(1).map((line) => {
    const cols = line.split(";");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj as unknown as CneRow;
  });
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    throw new Error(`No se encontró ${CSV_PATH}. Descarga el archivo desde CNE y guárdalo en dataset/.`);
  }
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const raw = readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(raw);
  const fechaActRaw = rows[0]?.fecha_act;
  const fechaAct = fechaActRaw ? parseDdMmYyyy(fechaActRaw) : null;
  if (!fechaAct) throw new Error(`No se pudo leer fecha_act del archivo (visto: "${fechaActRaw}")`);

  const { data: lastSync } = await client
    .from("cne_capacidad_sync_log")
    .select("fecha_act")
    .order("fecha_act", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSync?.fecha_act === fechaAct) {
    console.log(`Sin cambios: el archivo sigue fechado ${fechaAct} (última sincronización ya lo tiene). No se reprocesa.`);
    return;
  }

  // Agrupar por central (CNE viene a nivel de unidad generadora, no de central).
  const byPlant = new Map<string, CneRow[]>();
  for (const r of rows) {
    const key = `${r.sistema}|${r.central}`;
    const group = byPlant.get(key) ?? [];
    group.push(r);
    byPlant.set(key, group);
  }

  console.log(`Archivo fechado ${fechaAct}: ${rows.length} unidades -> ${byPlant.size} centrales.`);

  let inserted = 0;
  let totalCapacity = 0;
  // Mismo desfase que lib/ingestion/sources/cne/capacidad/runSync.ts: sin esto
  // los ids de la CNE chocan con los reales del Coordinador y cada fuente
  // sobreescribe filas de la otra.
  const CNE_ID_OFFSET = 1_000_000;
  let nextId = CNE_ID_OFFSET;
  const plantRows = [];

  for (const [externalKey, group] of byPlant) {
    const first = group[0];
    const netCapacityMw = group.reduce((sum, r) => sum + (parseChileanNumber(r.potencia_neta_mw) ?? 0), 0);
    const grossCapacityMw = group.reduce((sum, r) => sum + (parseChileanNumber(r.potencia_bruta_mw) ?? 0), 0);

    const east = parseChileanNumber(first.coord_este_utm);
    const north = parseChileanNumber(first.coord_norte_utm);
    const latLng = east !== null && north !== null && first.huso_utm ? utmToLatLng(east, north, first.huso_utm) : null;

    totalCapacity += netCapacityMw;
    plantRows.push({
      id_central: nextId++,
      external_key: externalKey,
      name: first.central,
      owner_name: first.propietario || first.razon_social || null,
      plant_type: mapPlantType(first.tipo_de_energia),
      technology_detail: first.tipo_de_energia || null,
      is_renewable: first.clasificacion === "ERNC",
      status: first.estado === "En Operacion" ? "Operativa" : first.estado === "En Pruebas" ? "En Pruebas" : first.estado,
      net_capacity_mw: netCapacityMw,
      gross_max_power_mw: grossCapacityMw,
      unit_count: group.length,
      region: first.region_nombre || null,
      comuna: first.comuna_nombre || null,
      utm_zone: first.huso_utm || null,
      utm_east: east,
      utm_north: north,
      latitude: latLng?.latitude ?? null,
      longitude: latLng?.longitude ?? null,
      is_hidden: false,
      synced_at: new Date().toISOString(),
    });
  }

  // Reemplazo completo — CNE no tiene IDs estables reutilizables entre cargas,
  // así que se trunca y repuebla en cada sincronización real (no en cada corrida:
  // solo cuando fecha_act cambió, chequeado arriba).
  // Solo las filas de esta fuente, no la tabla entera.
  const { error: deleteError } = await client.from("power_plant").delete().not("external_key", "is", null);
  if (deleteError) throw new Error(`Error limpiando power_plant: ${deleteError.message}`);

  const BATCH = 500;
  for (let i = 0; i < plantRows.length; i += BATCH) {
    const batch = plantRows.slice(i, i + BATCH);
    const { error } = await client.from("power_plant").insert(batch);
    if (error) throw new Error(`Error insertando lote ${i}: ${error.message}`);
    inserted += batch.length;
  }

  await client.from("cne_capacidad_sync_log").insert({
    fecha_act: fechaAct,
    row_count: inserted,
    total_capacity_mw: totalCapacity,
  });

  console.log(`\nListo: ${inserted} centrales cargadas desde CNE (fecha_act=${fechaAct}).`);
  console.log(`Capacidad neta total: ${Math.round(totalCapacity).toLocaleString("es-CL")} MW`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
