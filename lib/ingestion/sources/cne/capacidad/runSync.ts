import type { SupabaseClient } from "@supabase/supabase-js";
import { parseChileanNumber, utmToLatLng } from "@/lib/ingestion/sources/sipub/shared/utm";

const SOURCE_URL = "https://3b9x.short.gy/rZWIBx";

const PLANT_TYPE_MAP: Record<string, string> = {
  Solar: "Solares",
  "Solar-CSP": "Solares",
  "Solar Fotovoltaica": "Solares",
  Eólica: "Eólicas",
  "Hidráulica Embalse": "Hidroeléctricas",
  "Hidráulica Pasada": "Hidroeléctricas",
  "Mini Hidráulica Pasada": "Hidroeléctricas",
  Geotérmica: "Geotérmica",
};

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
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(";") ?? [];
  if (!headers.includes("central") || !headers.includes("fecha_act")) {
    throw new Error("La descarga de CNE no tiene el formato esperado.");
  }
  return lines.slice(1).map((line) => {
    const columns = line.split(";");
    return Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""])) as unknown as CneRow;
  });
}

function parseDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

async function downloadCsv(): Promise<string> {
  const shortResponse = await fetch(SOURCE_URL, { redirect: "manual", cache: "no-store" });
  const sharedLocation = shortResponse.headers.get("location");
  if (!sharedLocation) throw new Error("El enlace corto de CNE no redirigió a la fuente esperada.");

  const sharedUrl = new URL(sharedLocation, SOURCE_URL);
  const shareResponse = await fetch(sharedUrl, { redirect: "manual", cache: "no-store" });
  const fileLocation = shareResponse.headers.get("location");
  const cookie = shareResponse.headers.get("set-cookie")?.split(";", 1)[0];
  if (!fileLocation || !cookie) throw new Error("SharePoint no entregó la descarga pública de CNE.");

  const fileResponse = await fetch(new URL(fileLocation, sharedUrl), {
    headers: { cookie },
    redirect: "follow",
    cache: "no-store",
  });
  if (!fileResponse.ok) throw new Error(`No se pudo descargar el CSV de CNE (${fileResponse.status}).`);
  return fileResponse.text();
}

export interface CneCapacitySyncSummary {
  changed: boolean;
  sourceDate: string;
  plants: number;
  totalCapacityMw: number;
}

export async function runCneCapacitySync(
  client: SupabaseClient,
  /**
   * Recarga aunque la fuente no haya cambiado de fecha.
   *
   * Hace falta cuando lo que cambió es NUESTRO lado — un arreglo en cómo se
   * guardan las filas— y la fuente sigue igual. Sin esto la única salida sería
   * borrar a mano la última fila de `cne_capacidad_sync_log`, que es falsear el
   * historial de cargas para conseguir un efecto.
   */
  options: { force?: boolean } = {},
): Promise<CneCapacitySyncSummary> {
  const rows = parseCsv(await downloadCsv());
  if (rows.length < 100) throw new Error(`La descarga de CNE contiene muy pocas filas (${rows.length}).`);
  const sourceDate = parseDate(rows[0]?.fecha_act ?? "");
  if (!sourceDate) throw new Error(`No se pudo interpretar fecha_act: ${rows[0]?.fecha_act ?? "vacía"}.`);

  const { data: lastSync, error: logError } = await client
    .from("cne_capacidad_sync_log")
    .select("fecha_act, row_count, total_capacity_mw")
    .order("fecha_act", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (logError) throw new Error(`No se pudo consultar la última carga CNE: ${logError.message}`);
  if (lastSync?.fecha_act === sourceDate && !options.force) {
    return {
      changed: false,
      sourceDate,
      plants: lastSync.row_count,
      totalCapacityMw: Number(lastSync.total_capacity_mw),
    };
  }

  const grouped = new Map<string, CneRow[]>();
  for (const row of rows) {
    const key = `${row.sistema}|${row.central}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  /**
   * Los ids de esta fuente arrancan bien arriba para no chocar con los del
   * Coordinador.
   *
   * `id_central` es la clave primaria y no admite nulos, así que la CNE —que no
   * trae un id propio— tiene que inventarlo. Antes numeraba desde 1, y como
   * `sync-sipub-centrales` hace upsert por esa misma columna con los ids REALES
   * del Coordinador, cada central del Coordinador con id ≤1245 sobreescribía
   * una fila de la CNE: le cambiaba nombre, propietario y potencia, dejándole
   * la `external_key` de otra central. Así quedaron 580 filas cruzadas — la
   * clave decía "SEN|HE RAPEL" y la fila llevaba los datos de "PMGD HP DONGO".
   *
   * El Coordinador numera en el orden de los miles; un millón deja margen de
   * sobra y hace evidente, al mirar un id, de qué fuente viene la fila.
   */
  const CNE_ID_OFFSET = 1_000_000;
  let nextId = CNE_ID_OFFSET;
  let totalCapacityMw = 0;
  const plants = [...grouped].map(([externalKey, group]) => {
    const first = group[0];
    const netCapacityMw = group.reduce((sum, row) => sum + (parseChileanNumber(row.potencia_neta_mw) ?? 0), 0);
    const grossCapacityMw = group.reduce((sum, row) => sum + (parseChileanNumber(row.potencia_bruta_mw) ?? 0), 0);
    const east = parseChileanNumber(first.coord_este_utm);
    const north = parseChileanNumber(first.coord_norte_utm);
    const coordinates = east !== null && north !== null && first.huso_utm ? utmToLatLng(east, north, first.huso_utm) : null;
    totalCapacityMw += netCapacityMw;
    return {
      id_central: nextId++, external_key: externalKey, name: first.central,
      owner_name: first.propietario || first.razon_social || null,
      plant_type: PLANT_TYPE_MAP[first.tipo_de_energia] ?? "Termoeléctricas",
      technology_detail: first.tipo_de_energia || null, is_renewable: first.clasificacion === "ERNC",
      status: first.estado === "En Operacion" ? "Operativa" : first.estado === "En Pruebas" ? "En Pruebas" : first.estado,
      net_capacity_mw: netCapacityMw, gross_max_power_mw: grossCapacityMw, unit_count: group.length,
      region: first.region_nombre || null, comuna: first.comuna_nombre || null, utm_zone: first.huso_utm || null,
      utm_east: east, utm_north: north, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null,
      is_hidden: false, synced_at: new Date().toISOString(),
    };
  });

  // Solo se reemplazan las filas de ESTA fuente. Antes borraba la tabla entera
  // (`neq("id_central", -1)`), así que se llevaba puestas las centrales del
  // Coordinador hasta que su sync semanal las repusiera.
  const { error: deleteError } = await client.from("power_plant").delete().not("external_key", "is", null);
  if (deleteError) throw new Error(`No se pudo reemplazar la capacidad CNE: ${deleteError.message}`);
  for (let index = 0; index < plants.length; index += 500) {
    const { error } = await client.from("power_plant").insert(plants.slice(index, index + 500));
    if (error) throw new Error(`No se pudo insertar el lote CNE ${index}: ${error.message}`);
  }
  const { error: insertLogError } = await client.from("cne_capacidad_sync_log").insert({
    fecha_act: sourceDate, row_count: plants.length, total_capacity_mw: totalCapacityMw,
  });
  if (insertLogError) throw new Error(`No se pudo registrar la carga CNE: ${insertLogError.message}`);

  return { changed: true, sourceDate, plants: plants.length, totalCapacityMw };
}
