/**
 * Sincronización de PELP. Descarga los diccionarios y la tabla de expansión,
 * normaliza y hace upsert por clave lógica.
 *
 * No borra ni toca nada fuera de las tablas `pelp_*`. Una corrida repetida no
 * duplica: la restricción única
 * (scenario_id, model_version, asset_name_raw, technology_raw, node_raw, year)
 * hace que el upsert actualice en vez de insertar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPANSION_COLUMNS, PELP_SOURCE, PELP_TABLES, fetchPelpTable, type PelpRow } from "./fetch";
import { durationHoursFor, normalizeExpansionRow, normalizeTechnology } from "./normalize";

export interface PelpSyncSummary {
  scenarios: number;
  carriers: number;
  nodes: number;
  storageAssets: number;
  expansionRowsFetched: number;
  expansionRowsUpserted: number;
  expansionRowsSkipped: number;
  runId: string | null;
}

const CHUNK = 500;

export async function runPelpSync(client: SupabaseClient): Promise<PelpSyncSummary> {
  const retrievedAt = new Date().toISOString();

  const { data: run } = await client
    .from("pelp_extraction_run")
    .insert({
      status: "running",
      model_version: PELP_SOURCE.modelVersion,
      model_id: PELP_SOURCE.modelId,
      dataset_id: PELP_SOURCE.datasetId,
      source_url: PELP_SOURCE.sourceUrl,
    })
    .select("id")
    .single();
  const runId = (run?.id as string | undefined) ?? null;

  try {
    // --- diccionarios ---
    const escenarios = await fetchPelpTable(PELP_TABLES.escenarios, [
      "scenario",
      "nombre escenario",
      "demand_scenario",
      "climate_scenario",
      "hydrology_scenario",
      "generation_investment_cost_scenario",
      "storage_investment_cost_scenario",
      "fuel_price_scenario",
    ], 500);
    if (escenarios.length) {
      await client.from("pelp_scenario").upsert(
        escenarios.map((s) => ({
          scenario_id: String(s["scenario"]),
          scenario_name: String(s["nombre escenario"] ?? s["scenario"]),
          demand_scenario: s["demand_scenario"] as string | null,
          climate_scenario: s["climate_scenario"] as string | null,
          hydrology_scenario: s["hydrology_scenario"] as string | null,
          generation_investment_cost_scenario: s["generation_investment_cost_scenario"] as string | null,
          storage_investment_cost_scenario: s["storage_investment_cost_scenario"] as string | null,
          fuel_price_scenario: s["fuel_price_scenario"] as string | null,
          raw_record: s,
          updated_at: retrievedAt,
        })),
        { onConflict: "scenario_id" },
      );
    }

    const carriers = await fetchPelpTable(PELP_TABLES.carriers, ["carrier", "nombre carrier"], 500);
    if (carriers.length) {
      await client.from("pelp_carrier").upsert(
        carriers.map((c) => ({
          carrier: String(c["carrier"]),
          carrier_name: c["nombre carrier"] as string | null,
          technology_code: normalizeTechnology(c["carrier"] as string | null),
          updated_at: retrievedAt,
        })),
        { onConflict: "carrier" },
      );
    }

    const nodos = await fetchPelpTable(
      PELP_TABLES.nodos,
      ["name", "tension", "latitude", "longitude", "comuna", "provincia", "region"],
      5000,
    );
    if (nodos.length) {
      await client.from("pelp_node").upsert(
        nodos.map((n) => ({
          name: String(n["name"]),
          tension: n["tension"] as number | null,
          latitude: n["latitude"] as number | null,
          longitude: n["longitude"] as number | null,
          comuna: n["comuna"] as string | null,
          provincia: n["provincia"] as string | null,
          region: n["region"] as string | null,
          raw_record: n,
          updated_at: retrievedAt,
        })),
        { onConflict: "name" },
      );
    }

    const almacenamiento = await fetchPelpTable(
      PELP_TABLES.almacenamiento,
      [
        "name",
        "node",
        "carrier",
        "p_nom",
        "max_hours",
        "efficiency_store",
        "efficiency_dispatch",
        "p_nom_extendable",
        "build_year",
        "lifetime",
      ],
      5000,
    );
    if (almacenamiento.length) {
      await client.from("pelp_storage_asset").upsert(
        almacenamiento.map((a) => ({
          name: String(a["name"]),
          node: a["node"] as string | null,
          carrier: a["carrier"] as string | null,
          p_nom: a["p_nom"] as number | null,
          max_hours: a["max_hours"] as number | null,
          efficiency_store: a["efficiency_store"] as number | null,
          efficiency_dispatch: a["efficiency_dispatch"] as number | null,
          // PELP entrega el flag como texto ("True"/"False"), no como booleano.
          p_nom_extendable: String(a["p_nom_extendable"] ?? "").toLowerCase() === "true",
          build_year: a["build_year"] as number | null,
          lifetime: a["lifetime"] as number | null,
          raw_record: a,
          updated_at: retrievedAt,
        })),
        { onConflict: "name" },
      );
    }

    const storageByName = new Map(
      almacenamiento.map((a) => [String(a["name"]), { max_hours: (a["max_hours"] as number | null) ?? null }]),
    );

    // --- tabla de hechos ---
    const raw: PelpRow[] = await fetchPelpTable(PELP_TABLES.expansion, EXPANSION_COLUMNS);
    let skipped = 0;
    const filas = raw
      .map((row) => {
        const n = normalizeExpansionRow(row);
        if (!n) {
          skipped += 1;
          return null;
        }
        return {
          scenario_id: n.scenarioId,
          model_version: PELP_SOURCE.modelVersion,
          asset_name_raw: n.assetNameRaw,
          technology_raw: n.technologyRaw,
          node_raw: n.nodeRaw,
          year: n.year,
          asset_type: n.assetType,
          technology_code: n.technologyCode,
          capacity_expansion_mw: n.capacityExpansionMw,
          capacity_expansion_cumulative_mw: n.capacityExpansionCumulativeMw,
          capacity_expansion_mwh: n.capacityExpansionMwh,
          capacity_expansion_cumulative_mwh: n.capacityExpansionCumulativeMwh,
          duration_hours: n.technologyCode === "BESS" ? durationHoursFor(n.assetNameRaw, storageByName) : null,
          latitude: n.latitude,
          longitude: n.longitude,
          region_raw: n.regionRaw,
          provincia_raw: n.provinciaRaw,
          comuna_raw: n.comunaRaw,
          retrieved_at: retrievedAt,
          extraction_run_id: runId,
          raw_record: n.rawRecord,
          updated_at: retrievedAt,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    let upserted = 0;
    for (let i = 0; i < filas.length; i += CHUNK) {
      const lote = filas.slice(i, i + CHUNK);
      const { error } = await client
        .from("pelp_expansion")
        .upsert(lote, { onConflict: "scenario_id,model_version,asset_name_raw,technology_raw,node_raw,year" });
      if (error) throw new Error(`Error cargando expansión PELP: ${error.message}`);
      upserted += lote.length;
    }

    const summary: PelpSyncSummary = {
      scenarios: escenarios.length,
      carriers: carriers.length,
      nodes: nodos.length,
      storageAssets: almacenamiento.length,
      expansionRowsFetched: raw.length,
      expansionRowsUpserted: upserted,
      expansionRowsSkipped: skipped,
      runId,
    };

    if (runId) {
      await client
        .from("pelp_extraction_run")
        .update({
          status: "success",
          finished_at: new Date().toISOString(),
          rows_extracted: raw.length,
          rows_inserted: upserted,
        })
        .eq("id", runId);
    }
    return summary;
  } catch (err) {
    if (runId) {
      await client
        .from("pelp_extraction_run")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          error_message: (err as Error).message?.slice(0, 500) ?? "Error sin mensaje",
        })
        .eq("id", runId);
    }
    throw err;
  }
}
