/**
 * Cliente de la API anónima de Power BI para el reporte PELP.
 *
 * Cómo se descubrió (captura CDP del 2026-08-11, ver docs/DECISIONS.md):
 * energia.gob.cl embebe un Power BI publicado con "Publicar en la web". En ese
 * modo el bootstrap declara `powerBIAccessToken = 'any'` y `reportId = 'any'`:
 * la resource key sola autentica, no hay OAuth ni token que negociar.
 *
 * Dos detalles que cuestan horas si no se saben:
 *  - El host es `-api`. El `-redirect` que aparece en el HTML devuelve 403 en todo.
 *  - La respuesta viene en DSR comprimido: valores repetidos omitidos con un
 *    bitmask, y strings como índices a diccionarios. Ver decodeDsr.
 */

export const PELP_SOURCE = {
  resourceKey: "8cd41d5d-f70d-4dc3-8549-ff5bbee44509",
  modelId: 13117170,
  datasetId: "9689456e-33e4-4dd8-bfaf-ea01a7cc93fc",
  host: "https://wabi-south-central-us-api.analysis.windows.net",
  sourceUrl: "https://energia.gob.cl/pelp/proyecciones-electricas",
  sourceName: "Planificación Energética de Largo Plazo - Modelo de Expansión del SEN",
  modelVersion: "Informe Preliminar PELP 2028-2032",
} as const;

export const PELP_TABLES = {
  expansion: "2. [resultados] Expansión de generación y almacenamiento",
  escenarios: "1. [orden] Escenarios",
  carriers: "1. [orden] Carriers",
  nodos: "0. [diccionarios] Nodos",
  almacenamiento: "0. [diccionarios] Activos de almacenamiento",
} as const;

/** Columnas de la tabla de expansión. `capacity_expansion_MWh` se pide igual aunque hoy venga nulo. */
export const EXPANSION_COLUMNS = [
  "Año",
  "global_scenario",
  "asset_type",
  "asset",
  "bus",
  "carrier",
  "capacity_expansion_MW",
  "capacity_expansion_cumulative_MW",
  "capacity_expansion_MWh",
  "capacity_expansion_cumulative_MWh",
  "latitude",
  "longitude",
  "Región",
  "Provincia",
  "Comuna",
] as const;

export type PelpRow = Record<string, string | number | null>;

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function buildQuery(entity: string, columns: readonly string[], window: number) {
  const src = "t";
  return {
    version: "1.0.0",
    queries: [
      {
        Query: {
          Commands: [
            {
              SemanticQueryDataShapeCommand: {
                Query: {
                  Version: 2,
                  From: [{ Name: src, Entity: entity, Type: 0 }],
                  Select: columns.map((c) => ({
                    Column: { Expression: { SourceRef: { Source: src } }, Property: c },
                    Name: `${entity}.${c}`,
                    NativeReferenceName: c,
                  })),
                  OrderBy: [
                    {
                      Direction: 1,
                      Expression: { Column: { Expression: { SourceRef: { Source: src } }, Property: columns[0] } },
                    },
                  ],
                },
                Binding: {
                  Primary: { Groupings: [{ Projections: columns.map((_, i) => i) }] },
                  DataReduction: { DataVolume: 4, Primary: { Window: { Count: window } } },
                  Version: 1,
                },
                ExecutionMetricsKind: 1,
              },
            },
          ],
        },
        CacheKey: "",
        QueryId: "",
        ApplicationContext: { DatasetId: PELP_SOURCE.datasetId },
      },
    ],
    cancelQueries: [],
    modelId: PELP_SOURCE.modelId,
  };
}

/**
 * Decodifica el DSR de Power BI.
 *
 * `R` es un bitmask: bit i encendido significa que la columna i repite el valor
 * de la fila anterior y por eso NO viene en `C`. `Ø` marca nulos. Las columnas
 * con `DN` traen un índice al diccionario `ValueDicts`. Sin reconstruir esto la
 * tabla sale corrida una columna.
 */
export function decodeDsr(response: unknown, columnNames: readonly string[]): PelpRow[] {
  const ds = (response as { results?: Array<{ result?: { data?: { dsr?: { DS?: unknown[] } } } }> })
    ?.results?.[0]?.result?.data?.dsr?.DS?.[0] as
    | { ValueDicts?: Record<string, unknown[]>; PH?: Array<{ DM0?: unknown[] }> }
    | undefined;
  if (!ds) return [];

  const dicts = ds.ValueDicts ?? {};
  const dm = (ds.PH?.[0]?.DM0 ?? []) as Array<{
    S?: Array<{ N: string; DN?: string }>;
    C?: unknown[];
    R?: number;
    "Ø"?: number;
  }>;
  const schema = dm.find((r) => r.S)?.S ?? [];
  const dictOf = schema.map((s) => s.DN ?? null);

  const rows: PelpRow[] = [];
  let previous: unknown[] = [];
  for (const row of dm) {
    const cells = row.C ?? [];
    const repeatMask = row.R ?? 0;
    const nullMask = row["Ø"] ?? 0;
    const out: unknown[] = [];
    let cursor = 0;
    for (let i = 0; i < schema.length; i++) {
      if ((nullMask >> i) & 1) out[i] = null;
      else if ((repeatMask >> i) & 1) out[i] = previous[i] ?? null;
      else out[i] = cells[cursor++];
    }
    previous = out;

    const record: PelpRow = {};
    for (let i = 0; i < schema.length; i++) {
      const dictName = dictOf[i];
      let value = out[i];
      if (dictName && typeof value === "number") value = dicts[dictName]?.[value] ?? value;
      record[columnNames[i] ?? `col${i}`] = (value ?? null) as string | number | null;
    }
    rows.push(record);
  }
  return rows;
}

export async function fetchPelpTable(
  entity: string,
  columns: readonly string[],
  window = 30000,
): Promise<PelpRow[]> {
  const res = await fetch(`${PELP_SOURCE.host}/public/reports/querydata?synchronous=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-PowerBI-ResourceKey": PELP_SOURCE.resourceKey,
      Accept: "application/json, text/plain, */*",
      Origin: "https://app.powerbi.com",
      Referer: "https://app.powerbi.com/",
      ActivityId: uuid(),
      RequestId: uuid(),
    },
    body: JSON.stringify(buildQuery(entity, columns, window)),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`PELP querydata respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return decodeDsr(await res.json(), columns);
}
