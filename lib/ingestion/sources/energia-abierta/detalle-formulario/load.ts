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

  const { data: spv, error } = await client
    .from("spv")
    .insert({ name: companyName ?? "SPV", parent_company_id: companyId })
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
    .select("net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, capacity_mwh, includes_storage")
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

  if (Object.keys(patch).length > 0) await client.from("project").update(patch).eq("id", projectId);
}

export async function loadFormularioResult(
  client: SupabaseClient,
  projectId: string,
  result: FormularioResult,
): Promise<FormularioLoadResult> {
  const dataSourceId = await getDataSourceId(client);

  if (result.kind === "verification_only") {
    const { signedByName, signedByRole, signedByCompany } = result.data;
    const cleanCompany = signedByCompany && isPlausibleContactField(signedByCompany) ? signedByCompany : null;
    const companyId = await getOrCreateCompany(client, cleanCompany, null, null);
    const personIds: string[] = [];
    if (signedByName && isPlausibleContactField(signedByName)) {
      const personId = await getOrCreatePerson(client, signedByName, null, null, companyId);
      personIds.push(personId);
      if (companyId) {
        const role = signedByRole && isPlausibleContactField(signedByRole) ? signedByRole : "signer";
        await linkEntities(client, "person", personId, role, "company", companyId, dataSourceId);
      }
    }
    return { companyId, personIds };
  }

  const data = result.data;
  await enrichProjectPowerFields(client, projectId, data);
  const cleanCompanyName = data.companyName && isPlausibleContactField(data.companyName) ? data.companyName : null;
  const companyId = await getOrCreateCompany(client, cleanCompanyName, data.companyRut, data.companyLegalAddress);
  const personIds: string[] = [];

  for (const contact of data.contacts as FormularioContact[]) {
    if (!contact.name || !isPlausibleContactField(contact.name) || !ALLOWED_CONTACT_ROLES.has(contact.role)) continue;
    const personId = await getOrCreatePerson(client, contact.name, contact.email, contact.phone, companyId);
    personIds.push(personId);
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
