import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "./normalize";
import type { NormalizedProject } from "./types";
import { REJECTED_STATUSES } from "@/lib/data-access/projects";
import { prefilterProject } from "./prefilter";
import { getStatusMaturity } from "@/lib/shared/projectStatusMaturity";

const DATA_SOURCE_NAME = "Acceso Abierto - Coordinador Eléctrico Nacional (listado)";
const CONFIDENCE_PUBLIC = "PUBLICO";

/**
 * Regla de modelado Fehaciente/SUCTD (validada 2026-07-28 contra 43 casos reales +
 * la API en vivo del Coordinador — ver docs/07-regla-fehaciente-suctd.md): NO son
 * proyectos independientes, son solicitudes distintas para el mismo proyecto físico
 * en distintas etapas. Un "Proyecto Fehaciente" que debe presentar SUCTD queda
 * congelado en ese estado para siempre — la evolución real (autorizado, en
 * construcción, rechazado) solo se ve en la solicitud SUCTD. Y no es 1:1: puede
 * haber varios intentos de SUCTD (rechazados/desistidos) antes del que prospera.
 * Por eso el "maestro" no es fijo (ni siempre Fehaciente ni siempre SUCTD) sino el
 * expediente procesalmente más avanzado que no esté rechazado/desistido.
 */
export const FEHACIENTE_AWAITING_SUCTD_MARKER = "debe presentar suctd";

// La API siempre devuelve las solicitudes en el mismo orden. Si la corrida se
// corta antes de terminar (ej. timeout de función serverless en el cron), un
// orden fijo dejaría siempre la misma cola de proyectos sin sincronizar nunca
// — se mezcla para que, en unos días, todos terminen cubiertos en vez de que
// el mismo tramo inicial se reprocese cada vez mientras el final queda huérfano.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function statusRank(status: string | null): 0 | 1 | 2 {
  if (!status) return 1;
  const normalized = normalizeForMatch(status);
  if (REJECTED_STATUSES.some((s) => normalizeForMatch(s) === normalized)) return 0;
  if (normalized.includes(normalizeForMatch(FEHACIENTE_AWAITING_SUCTD_MARKER))) return 1;
  return 2;
}

/**
 * Un proyecto ya verificado a mano sigue recibiendo estado/fecha frescos del
 * sync (ver comentario "isVerified" más abajo) — pero si el cambio es un
 * retroceso de madurez o un rechazo, no debe aplicarse en silencio: se marca
 * para que un humano lo revise (ver /admin/revision-dudosos), sin dejar de
 * guardar el nuevo valor (ocultar el dato real sería peor que mostrarlo dudoso).
 * No se excluye la transición Fehaciente→SUCTD del retroceso: aunque el diseño
 * de statusRank la trata como esperada cuando genera una solicitud hermana
 * nueva, un caso real (BESS TAMANGO, 2026-08) la mostró ocurriendo sobre el
 * mismo external_reference viniendo de un estado ya avanzado ("declarado en
 * construcción") — ahí sí es una anomalía. Más barato descartar un falso
 * positivo con un clic que perder de vista un retroceso real.
 */
function reverificationReasonForStatusChange(oldStatus: string | null, newStatus: string): string | null {
  if (statusRank(newStatus) === 0) {
    return `El proyecto ya verificado pasó a estado "${newStatus}".`;
  }
  const oldMaturity = getStatusMaturity(oldStatus);
  const newMaturity = getStatusMaturity(newStatus);
  if (oldMaturity && newMaturity && newMaturity.order < oldMaturity.order) {
    return `El estado retrocedió de "${oldStatus}" a "${newStatus}" después de haber sido verificado.`;
  }
  return null;
}

/**
 * Actualizado 2026-08-02: antes excluía además cualquier solicitud con fecha
 * estimada de conexión ya pasada ("vencida"), asumiendo que era historial
 * descartable. Diagnóstico real contra la API (2026-08-02) mostró 267
 * solicitudes renovables/BESS activas (no rechazadas/desistidas) excluidas
 * solo por esa regla — en Chile es común que la fecha estimada se atrase sin
 * que el trámite deje de estar vivo, así que "vencida" no implica "muerta".
 * Ahora "vigente" solo excluye lo formalmente rechazado/desistido; no filtra
 * por fecha. (No confundir con applyPeriodFilter en lib/data-access/projects.ts,
 * que sigue usando fecha para el filtro de visualización de /proyectos-esperados
 * y el Verificador — ese es un filtro de UI, no de elegibilidad de ingesta.)
 */
export function isVigenteRow(row: NormalizedProject): boolean {
  return statusRank(row.statusLabel) !== 0;
}

export interface LoadSummary {
  totalRows: number;
  projectsCreated: number;
  projectsUpdated: number;
  projectsPromotedFromSibling: number;
  /** Cuántas de esas promociones cayeron sobre una ficha ya verificada a mano. */
  projectsPromotedOverVerified: number;
  solicitudesDiscardedAsInferior: number;
  companiesCreated: number;
  locationsCreated: number;
  connectionStatusesCreated: number;
  eventsFailed: number;
  skippedNotVigente: number;
  unmatchedRegions: Set<string>;
  unmatchedTechnologies: Set<string>;
}

export async function loadNormalizedProjects(
  client: SupabaseClient,
  rows: NormalizedProject[],
  options: { shuffleRows?: boolean } = {},
): Promise<LoadSummary> {
  const summary: LoadSummary = {
    totalRows: rows.length,
    projectsCreated: 0,
    projectsUpdated: 0,
    projectsPromotedFromSibling: 0,
    projectsPromotedOverVerified: 0,
    solicitudesDiscardedAsInferior: 0,
    companiesCreated: 0,
    locationsCreated: 0,
    connectionStatusesCreated: 0,
    eventsFailed: 0,
    skippedNotVigente: 0,
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

  // Para la regla Fehaciente/SUCTD (ver statusRank arriba): mapa de proyectos
  // existentes por nombre normalizado, para detectar "hermanos" sin una consulta
  // por fila. Se actualiza en memoria al promover o crear, para que dos solicitudes
  // nuevas del mismo proyecto dentro de la misma corrida también se detecten entre sí.
  // Paginado explícito: PostgREST corta en 1000 filas por defecto sin esto —
  // hallazgo real, con ~2700 proyectos muchos quedaban fuera del mapa y la regla
  // nunca los detectaba como hermanos (ver "Estela Solar Retiro", duplicado a
  // pesar de que la fila original ya estaba verificada).
  const allProjectRows: Array<{ id: string; name: string; external_reference: string | null; status: string | null; verified_at: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error: pageError } = await client
      .from("project")
      .select("id, name, external_reference, status, verified_at")
      .eq("country_id", countryId)
      .range(offset, offset + 999);
    if (pageError) throw new Error(`Error cargando proyectos existentes: ${pageError.message}`);
    allProjectRows.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  const projectsByNormalizedName = new Map<
    string,
    { id: string; externalReference: string | null; status: string | null; verifiedAt: string | null }
  >();
  for (const p of allProjectRows) {
    projectsByNormalizedName.set(normalizeForMatch(p.name as string), {
      id: p.id as string,
      externalReference: p.external_reference as string | null,
      status: p.status as string | null,
      verifiedAt: p.verified_at as string | null,
    });
  }

  /**
   * Índice de empresas por nombre normalizado, cargado de una vez.
   *
   * Antes la búsqueda era `ilike("name", name)` —texto exacto, tolerante solo a
   * mayúsculas— mientras que la clave normalizada se usaba únicamente para el
   * caché en memoria. Con eso, cualquier diferencia de formato creaba una
   * empresa nueva: la fuente escribe "Colbún S.A." y en la base estaba
   * "Colbún S.A", así que cada corrida agregaba una fila más.
   *
   * El efecto no era solo acumular duplicados: DESHACÍA cualquier consolidación
   * previa. Medido el 2026-08-19, una sola corrida recreó 87 empresas y movió
   * 425 proyectos a filas nuevas sin RUT, entre ellas las de Colbún, Engie y
   * Enel que se habían unificado el día anterior. La cobertura de identidad
   * societaria cayó de 86% a 68% en una noche.
   *
   * Se consultan también los alias: cuando una fusión absorbe una razón social,
   * guarda ese nombre en `entity_alias`. Es exactamente el nombre que la fuente
   * va a seguir enviando, así que sin esto la fusión dura hasta el próximo sync.
   */
  const companyByNormalizedName = new Map<string, string>();
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await client.from("company").select("id, name").range(offset, offset + 999);
    if (error) throw new Error(`Error cargando empresas: ${error.message}`);
    for (const row of page ?? []) {
      const key = normalizeForMatch(row.name as string);
      // La primera gana: si dos filas normalizan igual, quedan pendientes de
      // fusión y da lo mismo cuál se use, pero conviene ser determinista.
      if (key && !companyByNormalizedName.has(key)) companyByNormalizedName.set(key, row.id as string);
    }
    if (!page || page.length < 1000) break;
  }
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await client
      .from("entity_alias")
      .select("alias, entity_id")
      .eq("entity_type", "company")
      .range(offset, offset + 999);
    if (error) throw new Error(`Error cargando alias de empresas: ${error.message}`);
    for (const row of page ?? []) {
      const key = normalizeForMatch(row.alias as string);
      if (key && !companyByNormalizedName.has(key)) companyByNormalizedName.set(key, row.entity_id as string);
    }
    if (!page || page.length < 1000) break;
  }

  async function getOrCreateCompany(name: string): Promise<string> {
    const key = normalizeForMatch(name);
    const cached = companyCache.get(key);
    if (cached) return cached;

    const existing = companyByNormalizedName.get(key);
    if (existing) {
      companyCache.set(key, existing);
      return existing;
    }

    const { data: created, error } = await client
      .from("company")
      .insert({ name, country_id: countryId })
      .select("id")
      .single();
    if (error || !created) throw new Error(`Error creando empresa '${name}': ${error?.message}`);
    companyCache.set(key, created.id as string);
    companyByNormalizedName.set(key, created.id as string);
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
      .select("id, status, estimated_connection_date, verified_at")
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
    // Hallazgo real (2026-08-09, caso "Ríos de Jerez"): el listado no trae el
    // mismo nivel de detalle que el Formulario/preverificación con IA (ej. no
    // siempre tiene la capacidad de un BESS). Escribir esos null sobre un
    // proyecto no verificado borraba cada día lo que la preverificación había
    // extraído con confianza alta la corrida anterior — el admin llegaba a
    // verificar y encontraba campos vacíos que en realidad ya se habían
    // calculado bien. Un null del listado nunca es "confirmamos que no tiene
    // capacidad", es "esta fuente no trae ese detalle para esta fila" — no debe
    // pisar un valor ya conocido. Se usa tanto al actualizar un proyecto
    // existente como al promover un hermano (ver regla Fehaciente/SUCTD).
    const projectFieldsWithoutNulls = Object.fromEntries(
      Object.entries(projectFields).filter(([, value]) => value !== null),
    );

    if (existingProject) {
      // 1. Compute all diffs from the already-fetched state before mutating anything.
      // La fuente cambia ocasionalmente mayúsculas, acentos o espaciado sin que
      // exista una transición real. Conservamos el texto más reciente, pero no
      // generamos eventos ni reverificación por diferencias sólo tipográficas.
      const statusChanged = normalizeForMatch(existingProject.status ?? "") !== normalizeForMatch(row.statusLabel);
      const dateChanged = existingProject.estimated_connection_date !== row.estimatedConnectionDate;

      // Una vez verificado a mano en /admin/verificador, el sync ya no debe pisar la
      // ficha completa — solo lo que de verdad sigue moviéndose en el mundo real
      // (estado de la solicitud, fecha estimada de conexión). El resto (tecnología,
      // capacidad, storage, punto de conexión, etc.) queda congelado en lo que el
      // admin dejó, aunque el listado traiga un valor distinto la próxima corrida.
      const isVerified = !!existingProject.verified_at;
      const reverificationReason =
        isVerified && statusChanged ? reverificationReasonForStatusChange(existingProject.status, row.statusLabel) : null;
      const fieldsToUpdate = isVerified
        ? {
            status: row.statusLabel,
            estimated_connection_date: row.estimatedConnectionDate,
            ...(reverificationReason ? { needs_reverification: true, reverification_reason: reverificationReason } : {}),
          }
        : projectFieldsWithoutNulls;

      const { data: existingConnection } = await client
        .from("project_connection")
        .select("connection_point, substation_bay, voltage_level")
        .eq("project_id", existingProject.id)
        .maybeSingle();

      const pointChanged =
        !isVerified &&
        !!existingConnection &&
        (existingConnection.connection_point !== row.connectionPoint ||
          existingConnection.substation_bay !== row.substationBay);
      const connectionNeedsUpdate =
        !isVerified && !!existingConnection && (pointChanged || existingConnection.voltage_level !== row.voltageLevel);

      // 2. Apply the updates first. If any of these fail, we throw before writing any
      // event, so a retry re-diffs against unchanged source data and stays clean.
      const { error: updateError } = await client.from("project").update(fieldsToUpdate).eq("id", existingProject.id);
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
          previous_value: { status: existingProject.status },
          new_value: { status: row.statusLabel },
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
          previous_value: { estimatedConnectionDate: existingProject.estimated_connection_date },
          new_value: { estimatedConnectionDate: row.estimatedConnectionDate },
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
          previous_value: { connectionPoint: existingConnection.connection_point, substationBay: existingConnection.substation_bay },
          new_value: { connectionPoint: row.connectionPoint, substationBay: row.substationBay },
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

    // Regla Fehaciente/SUCTD (ver comentario junto a statusRank arriba): antes de
    // crear una fila nueva para una solicitud nunca vista, buscar si ya existe otra
    // fila (misma familia de nombre, distinto external_reference) representando el
    // mismo proyecto físico en otra etapa del trámite.
    const normalizedIncomingName = normalizeForMatch(row.projectName);
    const sibling = projectsByNormalizedName.get(normalizedIncomingName);

    if (sibling && sibling.externalReference !== row.externalId) {
      // Antes, una ficha verificada a mano nunca se promovía: la solicitud
      // hermana se descartaba en silencio, sumando uno a un contador que nadie
      // mira. El efecto real, medido el 2026-08-15: 3 de 198 proyectos
      // verificados llevaban semanas congelados con una SUCTD más avanzada
      // esperando — BESS Mirlo seguía en "Fehaciente debe presentar SUCTD"
      // mientras la fuente ya lo daba autorizado para declararse en
      // construcción.
      //
      // Decisión del usuario (2026-08-15): la promoción es avance del trámite,
      // no una corrección de lo que el humano validó, así que se aplica también
      // sobre fichas verificadas. `verified_at` NO se toca: quitarlo sacaría al
      // proyecto de Proyectos Futuros, que filtra por verificados, y un avance
      // regulatorio no puede despublicar un proyecto. Queda el evento en la
      // ficha para que el traspaso de expediente sea rastreable.
      const incomingRank = statusRank(row.statusLabel);
      const siblingRank = statusRank(sibling.status);
      if (incomingRank <= siblingRank) {
        // La solicitud entrante es igual o menos avanzada que lo que ya tenemos
        // (ej. un intento de SUCTD rechazado, o el Fehaciente original una vez que
        // ya existe una SUCTD viva) — no aporta un proyecto nuevo, se descarta.
        summary.solicitudesDiscardedAsInferior += 1;
        return;
      }

      // La solicitud entrante es más avanzada: "promueve" la fila existente en vez
      // de crear una hermana — mismo id, así los vínculos ya armados (contactos,
      // empresa, SEIA) siguen apuntando al proyecto sin necesidad de migrarlos.
      const { error: promoteError } = await client.from("project").update(projectFieldsWithoutNulls).eq("id", sibling.id);
      if (promoteError) {
        throw new Error(`Error promoviendo proyecto '${row.projectName}' (${row.externalId}) sobre hermano ${sibling.id}: ${promoteError.message}`);
      }
      await client
        .from("project_connection")
        .update({
          request_type: row.requestType,
          connection_point: row.connectionPoint,
          voltage_level: row.voltageLevel,
          substation_bay: row.substationBay,
          transmission_segment: row.transmissionSegment,
        })
        .eq("project_id", sibling.id);
      await client.from("project_event").insert({
        project_id: sibling.id,
        event_type: "status_change",
        occurred_at: new Date().toISOString(),
        previous_value: { status: sibling.status },
        new_value: { status: row.statusLabel, externalReference: row.externalId },
        data_source_id: dataSourceId,
        confidence_level: CONFIDENCE_PUBLIC,
        description:
          `Nueva solicitud ${row.externalId} (${row.requestType ?? "sin tipo"}) reemplaza a la anterior para el mismo proyecto` +
          // Se distingue en el texto porque no es lo mismo revisar el historial
          // de una ficha que nadie miró que el de una que alguien validó: en la
          // segunda, el traspaso ocurrió después de la revisión humana.
          (sibling.verifiedAt ? `. La ficha ya estaba verificada — el traspaso de expediente se aplicó igual` : ""),
      });
      summary.projectsPromotedFromSibling += 1;
      if (sibling.verifiedAt) summary.projectsPromotedOverVerified += 1;
      projectsByNormalizedName.set(normalizedIncomingName, {
        id: sibling.id, externalReference: row.externalId, status: row.statusLabel, verifiedAt: null,
      });
      return;
    }

    const prefilter = prefilterProject(row);
    const { data: project, error: projectError } = await client
      .from("project")
      .insert({
        ...projectFields,
        editorial_status: "pending",
        detected_at: new Date().toISOString(),
        prefilter_status: prefilter.status,
        prefilter_category: prefilter.category,
        prefilter_reason: prefilter.reason,
      })
      .select("id")
      .single();
    if (projectError || !project) {
      throw new Error(`Error creando proyecto '${row.projectName}' (${row.externalId}): ${projectError?.message}`);
    }
    summary.projectsCreated += 1;
    const projectId = project.id as string;
    projectsByNormalizedName.set(normalizedIncomingName, {
      id: projectId, externalReference: row.externalId, status: row.statusLabel, verifiedAt: null,
    });

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
      new_value: { status: row.statusLabel, requestType: row.requestType },
      data_source_id: dataSourceId,
      confidence_level: CONFIDENCE_PUBLIC,
      description: `Solicitud ${row.externalId} (${row.requestType ?? "sin tipo"}) ingresada a Acceso Abierto`,
    });
  }

  // "No vigente" (rechazado/desistido) solo debe impedir CREAR un proyecto
  // nuevo — nunca bloquear la actualización de uno que ya rastreamos. Sin este
  // chequeo de existencia, un proyecto que pasa a "Rechazada" después de
  // haber sido vigente queda congelado para siempre en su último estado
  // conocido, porque su fila se filtra fuera del pipeline por completo.
  // Hallazgo real (2026-08-08): BESS Talasa pasó a Rechazada y nunca se
  // reflejó, incluso corriendo el sync manual completo.
  const existingExternalReferences = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await client
      .from("project")
      .select("external_reference")
      .not("external_reference", "is", null)
      .range(offset, offset + 999);
    if (error) throw new Error(`No se pudo verificar proyectos existentes: ${error.message}`);
    for (const p of page ?? []) existingExternalReferences.add(p.external_reference as string);
    if (!page || page.length < 1000) break;
  }

  const vigenteRows = rows.filter((row) => {
    if (isVigenteRow(row) || existingExternalReferences.has(row.externalId)) return true;
    summary.skippedNotVigente += 1;
    return false;
  });

  const rowsToProcess = options.shuffleRows === false ? vigenteRows : shuffle(vigenteRows);
  for (const row of rowsToProcess) {
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
