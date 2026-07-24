import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "./normalize";
import type { NormalizedProject } from "./types";

const DATA_SOURCE_NAME = "Acceso Abierto - Coordinador Eléctrico Nacional (listado)";
const CONFIDENCE_PUBLIC = "PUBLICO";

export interface LoadSummary {
  totalRows: number;
  projectsCreated: number;
  projectsUpdated: number;
  companiesCreated: number;
  locationsCreated: number;
  connectionStatusesCreated: number;
  eventsFailed: number;
  unmatchedRegions: Set<string>;
  unmatchedTechnologies: Set<string>;
}

export async function loadNormalizedProjects(
  client: SupabaseClient,
  rows: NormalizedProject[],
): Promise<LoadSummary> {
  const summary: LoadSummary = {
    totalRows: rows.length,
    projectsCreated: 0,
    projectsUpdated: 0,
    companiesCreated: 0,
    locationsCreated: 0,
    connectionStatusesCreated: 0,
    eventsFailed: 0,
    unmatchedRegions: new Set(),
    unmatchedTechnologies: new Set(),
  };

  const { data: countryRow, error: countryError } = await client
    .from("country")
    .select("id")
    .eq("code", "CL")
    .single();
  if (countryError || !countryRow) {
    throw new Error(`No se encontró el país CL: ${countryError?.message}`);
  }
  const countryId = countryRow.id as string;

  const { data: dataSourceRow, error: dataSourceError } = await client
    .from("data_source")
    .select("id")
    .eq("name", DATA_SOURCE_NAME)
    .single();
  if (dataSourceError || !dataSourceRow) {
    throw new Error(`No se encontró el data_source '${DATA_SOURCE_NAME}': ${dataSourceError?.message}`);
  }
  const dataSourceId = dataSourceRow.id as string;

  const { data: regionRows, error: regionError } = await client
    .from("region")
    .select("id, name")
    .eq("country_id", countryId);
  if (regionError) throw new Error(`Error cargando regiones: ${regionError.message}`);
  const regionByNormalizedName = new Map<string, string>(
    (regionRows ?? []).map((r) => [normalizeForMatch(r.name as string), r.id as string]),
  );

  const { data: technologyRows, error: techError } = await client
    .from("technology")
    .select("id, code");
  if (techError) throw new Error(`Error cargando tecnologías: ${techError.message}`);
  const technologyByCode = new Map<string, string>(
    (technologyRows ?? []).map((t) => [t.code as string, t.id as string]),
  );

  const companyCache = new Map<string, string>();
  const locationCache = new Map<string, string>();
  const connectionStatusCache = new Map<string, string>();

  async function getOrCreateCompany(name: string): Promise<string> {
    const key = normalizeForMatch(name);
    const cached = companyCache.get(key);
    if (cached) return cached;

    const { data: existing } = await client
      .from("company")
      .select("id, name")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (existing) {
      companyCache.set(key, existing.id as string);
      return existing.id as string;
    }

    const { data: created, error } = await client
      .from("company")
      .insert({ name, country_id: countryId })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Error creando empresa '${name}': ${error?.message}`);
    companyCache.set(key, created.id as string);
    summary.companiesCreated += 1;
    return created.id as string;
  }

  async function getOrCreateLocation(regionRaw: string | null, comuna: string | null): Promise<string | null> {
    if (!regionRaw && !comuna) return null;
    const regionId = regionRaw ? regionByNormalizedName.get(normalizeForMatch(regionRaw)) : undefined;
    if (regionRaw && !regionId) summary.unmatchedRegions.add(regionRaw);

    const key = `${regionId ?? "null"}::${comuna ?? "null"}`;
    const cached = locationCache.get(key);
    if (cached) return cached;

    let query = client.from("location").select("id").eq("comuna", comuna ?? "");
    query = regionId ? query.eq("region_id", regionId) : query.is("region_id", null);
    const { data: existing } = await query.limit(1).maybeSingle();
    if (existing) {
      locationCache.set(key, existing.id as string);
      return existing.id as string;
    }

    const { data: created, error } = await client
      .from("location")
      .insert({ region_id: regionId ?? null, comuna })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Error creando ubicación: ${error?.message}`);
    locationCache.set(key, created.id as string);
    summary.locationsCreated += 1;
    return created.id as string;
  }

  async function getOrCreateConnectionStatus(label: string): Promise<void> {
    const code = normalizeForMatch(label).replace(/ /g, "_").slice(0, 60);
    if (connectionStatusCache.has(code)) return;

    const { data: existing } = await client
      .from("connection_status")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    if (existing) {
      connectionStatusCache.set(code, code);
      return;
    }

    const { error } = await client.from("connection_status").insert({ code, label });
    if (error && error.code !== "23505") {
      throw new Error(`Error creando connection_status '${label}': ${error.message}`);
    }
    connectionStatusCache.set(code, code);
    summary.connectionStatusesCreated += 1;
  }

  async function processRow(row: NormalizedProject): Promise<void> {
    const companyId = await getOrCreateCompany(row.companyName);
    const locationId = await getOrCreateLocation(row.regionRaw, row.comuna);
    await getOrCreateConnectionStatus(row.statusLabel);

    const technologyId = row.technologyCode ? technologyByCode.get(row.technologyCode) ?? null : null;
    if (!technologyId && row.technologyCode) summary.unmatchedTechnologies.add(row.technologyCode);

    const { data: existingProject } = await client
      .from("project")
      .select("id, status, estimated_connection_date")
      .eq("external_reference", row.externalId)
      .eq("country_id", countryId)
      .maybeSingle();

    const projectFields = {
      country_id: countryId,
      name: row.projectName,
      external_reference: row.externalId,
      nup: row.nup,
      technology_id: technologyId,
      includes_storage: row.includesStorage,
      location_id: locationId,
      developer_company_id: companyId,
      project_kind: row.projectKind,
      capacity_mw: row.capacityMw,
      capacity_mwh: row.capacityMwh,
      net_injection_mw: row.netInjectionMw,
      net_withdrawal_mw: row.netWithdrawalMw,
      generation_capacity_mw: row.generationCapacityMw,
      storage_capacity_mw: row.storageCapacityMw,
      storage_hours: row.storageHours,
      status: row.statusLabel,
      estimated_connection_date: row.estimatedConnectionDate,
    };

    if (existingProject) {
      // 1. Compute all diffs from the already-fetched state before mutating anything.
      const statusChanged = existingProject.status !== row.statusLabel;
      const dateChanged = existingProject.estimated_connection_date !== row.estimatedConnectionDate;

      const { data: existingConnection } = await client
        .from("project_connection")
        .select("connection_point, substation_bay, voltage_level")
        .eq("project_id", existingProject.id)
        .maybeSingle();

      const pointChanged =
        !!existingConnection &&
        (existingConnection.connection_point !== row.connectionPoint ||
          existingConnection.substation_bay !== row.substationBay);
      const connectionNeedsUpdate =
        !!existingConnection && (pointChanged || existingConnection.voltage_level !== row.voltageLevel);

      // 2. Apply the updates first. If any of these fail, we throw before writing any
      // event, so a retry re-diffs against unchanged source data and stays clean.
      const { error: updateError } = await client.from("project").update(projectFields).eq("id", existingProject.id);
      if (updateError) throw new Error(`Error actualizando proyecto '${row.projectName}' (${row.externalId}): ${updateError.message}`);

      if (connectionNeedsUpdate) {
        const { error: connectionUpdateError } = await client
          .from("project_connection")
          .update({
            connection_point: row.connectionPoint, substation_bay: row.substationBay, voltage_level: row.voltageLevel,
          })
          .eq("project_id", existingProject.id);
        if (connectionUpdateError) {
          throw new Error(
            `Error actualizando project_connection para '${row.projectName}' (${row.externalId}): ${connectionUpdateError.message}`,
          );
        }
      }

      // 3. Only after the updates succeeded do we record the diffed events. The field
      // updates above are already durable, so a failed event insert must NOT throw here:
      // throwing would trigger withRetry to reprocess the whole row, but the retry's diff
      // would find the DB already matching the source and silently skip the event forever,
      // and would also abort any later-ordered event inserts for this same row. Instead we
      // catch, count it in eventsFailed, warn, and keep going so sibling events still get
      // their chance to insert.
      if (statusChanged) {
        const { error: statusEventError } = await client.from("project_event").insert({
          project_id: existingProject.id, event_type: "status_change",
          occurred_at: new Date().toISOString(),
          previous_value: JSON.stringify({ status: existingProject.status }),
          new_value: JSON.stringify({ status: row.statusLabel }),
          data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
          description: `Cambió el estado de la solicitud: "${existingProject.status}" → "${row.statusLabel}"`,
        });
        if (statusEventError) {
          summary.eventsFailed += 1;
          console.warn(
            `Error creando evento status_change para '${row.projectName}' (${row.externalId}): ${statusEventError.message}`,
          );
        }
      }
      if (dateChanged) {
        const { error: dateEventError } = await client.from("project_event").insert({
          project_id: existingProject.id, event_type: "connection_date_change",
          occurred_at: new Date().toISOString(),
          previous_value: JSON.stringify({ estimatedConnectionDate: existingProject.estimated_connection_date }),
          new_value: JSON.stringify({ estimatedConnectionDate: row.estimatedConnectionDate }),
          data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
          description: `Cambió la fecha estimada de conexión`,
        });
        if (dateEventError) {
          summary.eventsFailed += 1;
          console.warn(
            `Error creando evento connection_date_change para '${row.projectName}' (${row.externalId}): ${dateEventError.message}`,
          );
        }
      }
      if (pointChanged && existingConnection) {
        const { error: pointEventError } = await client.from("project_event").insert({
          project_id: existingProject.id, event_type: "connection_point_change",
          occurred_at: new Date().toISOString(),
          previous_value: JSON.stringify({ connectionPoint: existingConnection.connection_point, substationBay: existingConnection.substation_bay }),
          new_value: JSON.stringify({ connectionPoint: row.connectionPoint, substationBay: row.substationBay }),
          data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
          description: `Cambió el punto de conexión`,
        });
        if (pointEventError) {
          summary.eventsFailed += 1;
          console.warn(
            `Error creando evento connection_point_change para '${row.projectName}' (${row.externalId}): ${pointEventError.message}`,
          );
        }
      }

      summary.projectsUpdated += 1;
      return;
    }

    const { data: project, error: projectError } = await client
      .from("project")
      .insert(projectFields)
      .select("id")
      .single();
    if (projectError || !project) {
      throw new Error(`Error creando proyecto '${row.projectName}' (${row.externalId}): ${projectError?.message}`);
    }
    summary.projectsCreated += 1;
    const projectId = project.id as string;

    await client.from("project_connection").insert({
      project_id: projectId,
      request_type: row.requestType,
      connection_point: row.connectionPoint,
      voltage_level: row.voltageLevel,
      substation_bay: row.substationBay,
      transmission_segment: row.transmissionSegment,
    });

    const attributionFields: Array<[string, unknown]> = [
      ["capacity_mw", row.capacityMw],
      ["capacity_mwh", row.capacityMwh],
      ["status", row.statusLabel],
      ["estimated_connection_date", row.estimatedConnectionDate],
    ];
    for (const [fieldName, value] of attributionFields) {
      if (value === null || value === undefined) continue;
      await client.from("data_attribution").insert({
        entity_type: "project",
        entity_id: projectId,
        field_name: fieldName,
        value: JSON.stringify(value),
        data_source_id: dataSourceId,
        source_date: row.receivedAt?.slice(0, 10) ?? null,
        confidence_level: CONFIDENCE_PUBLIC,
        verification_status: "unverified",
      });
    }

    await client.from("project_event").insert({
      project_id: projectId,
      event_type: "announced",
      occurred_at: row.receivedAt ?? new Date().toISOString(),
      new_value: JSON.stringify({ status: row.statusLabel, requestType: row.requestType }),
      data_source_id: dataSourceId,
      confidence_level: CONFIDENCE_PUBLIC,
      description: `Solicitud ${row.externalId} (${row.requestType ?? "sin tipo"}) ingresada a Acceso Abierto`,
    });
  }

  for (const row of rows) {
    await withRetry(() => processRow(row), `proyecto ${row.externalId} (${row.projectName})`);
  }

  return summary;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts) throw err;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`Reintentando ${label} (intento ${attempt}/${attempts} falló: ${message})`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error("unreachable");
}
