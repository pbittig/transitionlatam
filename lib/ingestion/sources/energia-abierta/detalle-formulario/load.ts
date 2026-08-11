import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormularioContact, FormularioData, FormularioResult } from "./types";

const DATA_SOURCE_NAME = "Acceso Abierto - Coordinador Eléctrico Nacional (Formulario por proyecto)";
const CONFIDENCE_PUBLIC = "PUBLICO";

// El prompt de extracción pide exactamente estos 3 roles (ver extractWithAi.ts),
// pero la IA a veces no lo respeta y devuelve texto libre ("Senior Grid
// Engineer", "Ingeniero de Estudios y Conexiones") que no corresponde a un
// contacto real de la empresa solicitante — se descarta en vez de guardarlo,
// ya el tipo `FormularioContact["role"]` solo lo declara en compilación, no en runtime.
const ALLOWED_CONTACT_ROLES = new Set(["legal_representative", "project_coordinator_1", "project_coordinator_2"]);

// El parser de regex del checklist de verificación (parseVerificationChecklist en
// parsePdf.ts) puede pescar dos firmantes de una tabla en dos columnas como si
// fueran un solo campo (ej. "Jaime Pino Cox \tNombre: Constanza Busquets Escuer"),
// o capturar una etiqueta de campo del PDF en vez de un valor real (ej. nombre
// "Cargo:", cargo "Empresa:") — ver hallazgo real "BESS II San Andrés". Un campo
// con estas marcas nunca es un dato de contacto válido; se descarta en vez de
// guardar basura.
function isPlausibleContactField(value: string): boolean {
  return !/\t|Nombre:|Cargo:|Empresa:/i.test(value);
}

const COMBINING_DIACRITICS_RE = new RegExp("[\\u0300-\\u036f]", "g");

function stripAccentsLower(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS_RE, "").toLowerCase();
}

/**
 * Red de seguridad contra el mismo problema que ya describe el SYSTEM_PROMPT de
 * extractWithAi.ts: el texto del PDF puede traer nombres, teléfonos y correos
 * desordenados, y la IA reconstruye la asociación por contexto — a veces mal
 * (hallazgo real: el email de "Laura Landeta" quedó pegado al representante legal de
 * otra empresa solo porque ambos formularios repetían otro nombre). Se exige que el
 * correo contenga al menos una palabra de 3+ letras del nombre de la persona; si no
 * calza, se descarta el correo (se guarda igual el contacto, sin ese dato) en vez de
 * arriesgar guardar un correo de otra persona.
 */
function emailMatchesName(name: string, email: string): boolean {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return false;
  const localPart = stripAccentsLower(email.slice(0, atIndex)).replace(/[^a-z0-9]/g, "");
  const nameWords = stripAccentsLower(name)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3);
  return nameWords.some((word) => localPart.includes(word));
}

/**
 * Red de seguridad de forma para el teléfono, mismo criterio que RUT_PATTERN en
 * extractWithAi.ts: un valor con forma equivocada es peor que null. No valida el
 * número real (no hay forma de confirmarlo sin llamar), solo descarta lo que
 * claramente no es un teléfono (texto, fechas mal leídas, campos vacíos con
 * ruido) — entre 7 y 12 dígitos cubre fijos y móviles chilenos con o sin +56,
 * y también prefijos de otros países que a veces aparecen en el Formulario.
 */
function isPlausiblePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 12;
}

// Nombres/correos de ejemplo que trae el Formulario del Coordinador cuando el PDF
// no estaba realmente lleno — la IA los extraía como si fueran contactos reales
// (hallazgo real: "Juan Pérez"/juan.perez@empresa.com terminó vinculado como
// representante legal de 8 empresas distintas). Se descartan enteros, no solo el
// correo, porque el nombre en sí tampoco es un dato real.
const PLACEHOLDER_NAME_PATTERNS = [/^juan\s+p[eé]rez$/i, /^mar[ií]a\s+l[oó]pez$/i, /^carlos\s+d[ií]az$/i, /^carlos\s+rojas$/i];
const PLACEHOLDER_EMAIL_DOMAINS = new Set(["empresa.com", "empresa.cl"]);

function isPlaceholderContact(name: string, email: string | null): boolean {
  if (PLACEHOLDER_NAME_PATTERNS.some((re) => re.test(name.trim()))) return true;
  const domain = email?.split("@")[1]?.toLowerCase().trim();
  return !!domain && PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

/**
 * El mismo problema que PLACEHOLDER_NAME_PATTERNS, pero del lado de la empresa —
 * que hasta ahora no estaba cubierto. La plantilla en blanco del Formulario trae
 * nombres de relleno ("Empresa de Energía S.A.") y RUT de ejemplo (12.345.678-9);
 * cuando la extracción no logra leer el titular real, esos valores se guardaban
 * como si fueran el dato. Al 2026-08-11 había 49 SPV y 30 proyectos reales
 * colgando de seis empresas inventadas así, con filas creadas ese mismo día.
 *
 * Los patrones van anclados y completos a propósito: un `^empresa de` suelto
 * también atraparía "Empresa de Transporte de Pasajeros Metro S.A.", que es
 * Metro de Santiago y es real.
 */
const PLACEHOLDER_COMPANY_PATTERNS = [
  /^empresa\s+de\s+generaci[oó]n(\s+(energ[eé]tica|el[eé]ctrica))?\s+s\.?\s?a\.?$/i,
  /^empresa\s+de\s+energ[ií]a(\s+renovable)?\s+s\.?\s?a\.?$/i,
  /^empresa\s+chile\s+s\.?\s?a\.?$/i,
];

/** RUT de ejemplo de la plantilla, normalizados sin puntos ni guion. */
const PLACEHOLDER_RUTS = new Set(["123456789", "761234567", "761234568", "76543210k"]);

function normalizeRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toLowerCase();
}

function isPlaceholderCompanyName(name: string): boolean {
  return PLACEHOLDER_COMPANY_PATTERNS.some((re) => re.test(name.trim()));
}

function isPlaceholderRut(rut: string): boolean {
  return PLACEHOLDER_RUTS.has(normalizeRut(rut));
}

export interface FormularioLoadResult {
  companyId: string | null;
  personIds: string[];
}

async function getDataSourceId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.from("data_source").select("id").eq("name", DATA_SOURCE_NAME).single();
  if (error || !data) throw new Error(`No se encontró el data_source '${DATA_SOURCE_NAME}': ${error?.message}`);
  return data.id as string;
}

/** RUT es la clave preferida (más confiable que el nombre — ver ADR/migración 20260720000008). */
export async function getOrCreateCompany(
  client: SupabaseClient,
  name: string | null,
  rut: string | null,
  legalAddress: string | null,
): Promise<string | null> {
  // Se descartan por separado a propósito: un Formulario puede traer el nombre
  // real de la SPV con el RUT de ejemplo sin corregir (caso real: "Bridge
  // Almacenamiento Uno SpA" con rut 12.345.678-9). Descartar solo el campo
  // inventado conserva el que sí sirve.
  if (name && isPlaceholderCompanyName(name)) name = null;
  if (rut && isPlaceholderRut(rut)) rut = null;

  if (!name && !rut) return null;

  if (rut) {
    const { data: byRut } = await client.from("company").select("id, legal_name, legal_address").eq("rut", rut).maybeSingle();
    if (byRut) {
      const patch: Record<string, unknown> = {};
      if (!byRut.legal_name && name) patch.legal_name = name;
      if (!byRut.legal_address && legalAddress) patch.legal_address = legalAddress;
      if (Object.keys(patch).length > 0) await client.from("company").update(patch).eq("id", byRut.id);
      return byRut.id as string;
    }
  }

  if (name) {
    const { data: byName } = await client.from("company").select("id, rut, legal_address").ilike("name", name).maybeSingle();
    if (byName) {
      const patch: Record<string, unknown> = {};
      if (rut && !byName.rut) patch.rut = rut;
      if (legalAddress && !byName.legal_address) patch.legal_address = legalAddress;
      if (Object.keys(patch).length > 0) await client.from("company").update(patch).eq("id", byName.id);
      return byName.id as string;
    }
  }

  const { data: created, error } = await client
    .from("company")
    .insert({ name: name ?? rut, rut, legal_name: name, legal_address: legalAddress })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Error creando empresa '${name}': ${error?.message}`);
  return created.id as string;
}

async function getOrCreatePerson(
  client: SupabaseClient,
  name: string,
  email: string | null,
  phone: string | null,
  companyId: string | null,
): Promise<string> {
  if (email) {
    const { data: byEmail } = await client.from("person").select("id, phone").ilike("email", email).maybeSingle();
    if (byEmail) {
      if (phone && !byEmail.phone) await client.from("person").update({ phone }).eq("id", byEmail.id);
      return byEmail.id as string;
    }
  }

  // Encontrado solo por nombre: puede venir de un documento previo más pobre de
  // la MISMA empresa (ej. el checklist de verificación, sin contacto) —
  // enriquecer si ahora tenemos email/teléfono que antes no había. Acotado a
  // personas ya vinculadas a companyId — sin esto, un nombre coincidente entre
  // solicitudes de dos empresas distintas contamina el contacto de una con el
  // dato de la otra (hallazgo real: el email de "Laura Landeta" del formulario
  // de Solar Chile Energía II quedó pegado al representante legal de Pacific
  // Hydro solo porque ambos documentos escriben "Luis Enrique Arqueros Wood").
  // Sin companyId (empresa aún no resuelta) no hay cómo acotar — no se reutiliza.
  if (companyId) {
    const { data: relatedPersonRows } = await client
      .from("entity_relationship")
      .select("source_id")
      .eq("source_type", "person")
      .eq("target_type", "company")
      .eq("target_id", companyId);
    const relatedPersonIds = (relatedPersonRows ?? []).map((r) => r.source_id as string);

    if (relatedPersonIds.length > 0) {
      const { data: byName } = await client
        .from("person")
        .select("id, email, phone")
        .ilike("full_name", name)
        .in("id", relatedPersonIds)
        .maybeSingle();
      if (byName) {
        const patch: Record<string, string> = {};
        if (email && !byName.email) patch.email = email;
        if (phone && !byName.phone) patch.phone = phone;
        if (Object.keys(patch).length > 0) await client.from("person").update(patch).eq("id", byName.id);
        return byName.id as string;
      }
    }
  }

  const { data: created, error } = await client
    .from("person")
    .insert({ full_name: name, email, phone })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Error creando persona '${name}': ${error?.message}`);
  return created.id as string;
}

async function linkEntities(
  client: SupabaseClient,
  sourceType: string,
  sourceId: string,
  relationshipType: string,
  targetType: string,
  targetId: string,
  dataSourceId: string,
  confidenceLevel: string = CONFIDENCE_PUBLIC,
): Promise<void> {
  const { data: existing } = await client
    .from("entity_relationship")
    .select("id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("relationship_type", relationshipType)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (existing) return;

  await client.from("entity_relationship").insert({
    source_type: sourceType,
    source_id: sourceId,
    relationship_type: relationshipType,
    target_type: targetType,
    target_id: targetId,
    data_source_id: dataSourceId,
    confidence_level: confidenceLevel,
  });
}

async function linkCompanyAsSpv(
  client: SupabaseClient,
  projectId: string,
  companyId: string,
  companyName: string | null,
  dataSourceId: string,
): Promise<void> {
  // Supuesto de trabajo: sin un documento que distinga SPV de empresa matriz,
  // se asume que la "Razón Social" solicitante es la SPV del proyecto. Ver
  // docs/04-modelo-datos.md §4.9 y ADR correspondiente — no se sobrescribe si
  // el proyecto ya tiene un spv_id asignado por otra fuente.
  const { data: project } = await client.from("project").select("spv_id").eq("id", projectId).maybeSingle();
  if (!project || project.spv_id) return;

  // Sin nombre real no se inventa una SPV. Antes caía en el literal "SPV", y con
  // el nombre de relleno de la plantilla creaba una sociedad ficticia colgando de
  // una matriz igual de ficticia — así se generaron las 49 SPV basura detectadas
  // el 2026-08-11. Es preferible dejar el proyecto sin SPV que atribuirle una falsa.
  if (!companyName || isPlaceholderCompanyName(companyName)) return;

  const { data: spv, error } = await client
    .from("spv")
    .insert({ name: companyName, parent_company_id: companyId })
    .select("id")
    .single();
  if (error || !spv) return;

  await client.from("project").update({ spv_id: spv.id }).eq("id", projectId);
  await client.from("entity_relationship").insert({
    source_type: "spv",
    source_id: spv.id,
    relationship_type: "parent_company",
    target_type: "company",
    target_id: companyId,
    data_source_id: dataSourceId,
    confidence_level: "ESTIMADO",
  });
}

/**
 * El pipeline de "listado" (energia-abierta/listado/load.ts) ya puebla estas
 * columnas desde el CSV de solicitudes — el Formulario solo debe rellenar lo
 * que esa fuente dejó en null, nunca pisar un valor ya cargado (mismo criterio
 * defensivo que getOrCreateCompany/getOrCreatePerson en este archivo). Sin
 * este enriquecimiento, el desglose de generación/almacenamiento que la IA
 * ahora sí extrae del Formulario nunca llegaba a la base de datos.
 */
async function enrichProjectPowerFields(client: SupabaseClient, projectId: string, data: FormularioData): Promise<void> {
  const { data: project } = await client
    .from("project")
    .select("net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, capacity_mwh, includes_storage, capacity_mw, project_kind")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return;

  const patch: Record<string, unknown> = {};
  if (project.net_injection_mw === null && data.netInjectionMw !== null) patch.net_injection_mw = data.netInjectionMw;
  if (project.net_withdrawal_mw === null && data.netWithdrawalMw !== null) patch.net_withdrawal_mw = data.netWithdrawalMw;
  if (project.generation_capacity_mw === null && data.generationComponentMw !== null) patch.generation_capacity_mw = data.generationComponentMw;
  if (project.storage_capacity_mw === null && data.storageComponentMw !== null) patch.storage_capacity_mw = data.storageComponentMw;
  if (project.storage_hours === null && data.storageHours !== null) patch.storage_hours = data.storageHours;
  if (project.capacity_mwh === null && data.storageEnergyMwh !== null) patch.capacity_mwh = data.storageEnergyMwh;
  if (!project.includes_storage && (data.storageComponentMw !== null || data.storageEnergyMwh !== null || data.storageHours !== null)) {
    patch.includes_storage = true;
  }

  // El listado (Coordinador) no reporta potencia para la mayoría de las solicitudes
  // (confirmado: solo 28/2766 la traen) — capacity_mw queda null ahí aunque el
  // Formulario sí tenga el desglose. Misma prioridad que computeHeadlineCapacity en
  // listado/normalize.ts, para que el campo "titular" quede consistente sin importar
  // cuál de las dos fuentes lo completó.
  if (project.capacity_mw === null) {
    const netInjection = project.net_injection_mw ?? data.netInjectionMw;
    const netWithdrawal = project.net_withdrawal_mw ?? data.netWithdrawalMw;
    const generation = project.generation_capacity_mw ?? data.generationComponentMw;
    const storage = project.storage_capacity_mw ?? data.storageComponentMw;
    const headline =
      project.project_kind === "consumption" ? netWithdrawal
        : project.project_kind === "storage" ? storage
          : netInjection ?? generation;
    if (headline !== null && headline !== undefined) patch.capacity_mw = headline;
  }

  if (Object.keys(patch).length > 0) await client.from("project").update(patch).eq("id", projectId);
}

export async function loadFormularioResult(
  client: SupabaseClient,
  projectId: string,
  result: FormularioResult,
  options: { enrichProject?: boolean } = {},
): Promise<FormularioLoadResult> {
  const dataSourceId = await getDataSourceId(client);

  if (result.kind === "verification_only") {
    const { signedByName, signedByRole, signedByCompany } = result.data;
    const cleanCompany = signedByCompany && isPlausibleContactField(signedByCompany) ? signedByCompany : null;
    const companyId = await getOrCreateCompany(client, cleanCompany, null, null);
    const personIds: string[] = [];
    if (signedByName && isPlausibleContactField(signedByName) && !isPlaceholderContact(signedByName, null)) {
      const personId = await getOrCreatePerson(client, signedByName, null, null, companyId);
      personIds.push(personId);
      const role = signedByRole && isPlausibleContactField(signedByRole) ? signedByRole : "signer";
      await linkEntities(client, "person", personId, role, "project", projectId, dataSourceId);
      if (companyId) {
        await linkEntities(client, "person", personId, role, "company", companyId, dataSourceId);
      }
    }
    return { companyId, personIds };
  }

  const data = result.data;
  if (options.enrichProject !== false) {
    await enrichProjectPowerFields(client, projectId, data);
  }
  const cleanCompanyName = data.companyName && isPlausibleContactField(data.companyName) ? data.companyName : null;
  const companyId = await getOrCreateCompany(client, cleanCompanyName, data.companyRut, data.companyLegalAddress);
  const personIds: string[] = [];

  for (const contact of data.contacts as FormularioContact[]) {
    if (!contact.name || !isPlausibleContactField(contact.name) || !ALLOWED_CONTACT_ROLES.has(contact.role)) continue;
    if (isPlaceholderContact(contact.name, contact.email)) continue;
    const verifiedEmail = contact.email && emailMatchesName(contact.name, contact.email) ? contact.email : null;
    const verifiedPhone = contact.phone && isPlausiblePhone(contact.phone) ? contact.phone : null;
    const personId = await getOrCreatePerson(client, contact.name, verifiedEmail, verifiedPhone, companyId);
    personIds.push(personId);
    // Vínculo a nivel de PROYECTO (autoritativo para getProjectStakeholders — solo
    // muestra contactos de la ficha específica, nunca del resto de proyectos de la
    // misma empresa) además del vínculo a la empresa, que se conserva para vistas
    // agregadas por empresa (ver scripts/audit-formulario-contacts.ts).
    await linkEntities(client, "person", personId, contact.role, "project", projectId, dataSourceId);
    if (companyId) {
      await linkEntities(client, "person", personId, contact.role, "company", companyId, dataSourceId);
    }
  }

  if (companyId) {
    await linkEntities(client, "project", projectId, "developed_by", "company", companyId, dataSourceId);
    await linkCompanyAsSpv(client, projectId, companyId, cleanCompanyName, dataSourceId);
  }

  return { companyId, personIds };
}
