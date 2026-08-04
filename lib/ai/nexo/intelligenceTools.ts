import type { NexoTool } from "./types";

function objectArgs(raw: unknown): Record<string, unknown> {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Argumentos invalidos");
  return value as Record<string, unknown>;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Identificador invalido");
  }
  return value;
}

export const projectDetailTool: NexoTool = {
  intents: ["project_lookup", "market_analysis", "data_quality"],
  definition: {
    type: "function",
    function: {
      name: "get_project",
      description: "Obtiene la ficha estructurada de un proyecto por su UUID, incluyendo empresa, ubicacion, conexion y expediente SEIA.",
      parameters: { type: "object", properties: { projectId: { type: "string" } }, required: ["projectId"] },
    },
  },
  async execute(client, raw) {
    const projectId = uuid(objectArgs(raw).projectId);
    const { data, error } = await client
      .from("project")
      .select("id,name,internal_code,status,capacity_mw,capacity_mwh,generation_capacity_mw,storage_capacity_mw,storage_hours,includes_storage,estimated_connection_date,updated_at,technology:technology_id(name,code),location:location_id(comuna,address,region:region_id(name)),developer:developer_company_id(id,name,rut),spv:spv_id(id,name),connection:project_connection(connection_point,voltage_level,request_type),seia:seia_record(id,nombre,status,submission_type,filed_at,investment_amount,url_ficha,updated_at)")
      .eq("id", projectId)
      .eq("editorial_status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { project: data ?? null, projectPath: data ? `/proyectos/${projectId}` : null };
  },
};

export const companySearchTool: NexoTool = {
  intents: ["company_lookup", "market_analysis"],
  definition: {
    type: "function",
    function: {
      name: "search_companies",
      description: "Busca empresas por nombre o RUT y devuelve sus proyectos publicados relacionados.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 10 } },
        required: ["query"],
      },
    },
  },
  async execute(client, raw) {
    const args = objectArgs(raw);
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
    if (query.length < 2) throw new Error("La busqueda requiere al menos 2 caracteres");
    const limit = Math.min(10, Math.max(1, typeof args.limit === "number" ? Math.trunc(args.limit) : 6));
    const escaped = query.replace(/[,%()]/g, " ");
    const { data: companies, error } = await client
      .from("company")
      .select("id,name,legal_name,rut,legal_address,updated_at")
      .or(`name.ilike.%${escaped}%,legal_name.ilike.%${escaped}%,rut.ilike.%${escaped}%`)
      .order("name")
      .limit(limit);
    if (error) throw new Error(error.message);
    const ids = (companies ?? []).map((company) => String(company.id));
    const { data: projects, error: projectError } = ids.length
      ? await client.from("project").select("id,name,status,capacity_mw,capacity_mwh,estimated_connection_date,developer_company_id").in("developer_company_id", ids).eq("editorial_status", "published").limit(50)
      : { data: [], error: null };
    if (projectError) throw new Error(projectError.message);
    return {
      count: companies?.length ?? 0,
      companies: (companies ?? []).map((company) => ({
        ...company,
        projects: (projects ?? []).filter((project) => project.developer_company_id === company.id).map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          capacity_mw: project.capacity_mw,
          capacity_mwh: project.capacity_mwh,
          estimated_connection_date: project.estimated_connection_date,
        })),
      })),
    };
  },
};

export const evidenceTool: NexoTool = {
  intents: ["project_lookup", "company_lookup", "market_analysis", "data_quality"],
  definition: {
    type: "function",
    function: {
      name: "get_evidence",
      description: "Obtiene proveniencia, fuente, fecha y confianza para un proyecto o empresa. Usala para respaldar afirmaciones factuales.",
      parameters: {
        type: "object",
        properties: { entityType: { type: "string", enum: ["project", "company"] }, entityId: { type: "string" } },
        required: ["entityType", "entityId"],
      },
    },
  },
  async execute(client, raw) {
    const args = objectArgs(raw);
    const entityType = args.entityType === "company" ? "company" : "project";
    const entityId = uuid(args.entityId);
    const { data, error } = await client
      .from("data_attribution")
      .select("field_name,value,source_date,collected_at,confidence_level,verification_status,is_current,data_source:data_source_id(name,base_url,source_type)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("is_current", true)
      .order("collected_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { entityType, entityId, evidence: data ?? [], count: data?.length ?? 0 };
  },
};

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export const dataQualityTool: NexoTool = {
  intents: ["data_quality"],
  definition: {
    type: "function",
    function: {
      name: "data_quality_check",
      description: "Revisa deterministicamente la cartera publicada para detectar nombres duplicados, campos criticos faltantes y capacidades invalidas.",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "Maximo de ejemplos por categoria." } },
      },
    },
  },
  async execute(client, raw) {
    const args = objectArgs(raw);
    const limit = Math.min(20, Math.max(1, typeof args.limit === "number" ? Math.trunc(args.limit) : 10));
    const rows: Array<{
      id: string; name: string; status: string | null; capacity_mw: number | null; capacity_mwh: number | null;
      estimated_connection_date: string | null; developer_company_id: string | null; spv_id: string | null; technology_id: string | null;
    }> = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client
        .from("project")
        .select("id,name,status,capacity_mw,capacity_mwh,estimated_connection_date,developer_company_id,spv_id,technology_id")
        .eq("editorial_status", "published")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const byName = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = normalizeName(row.name);
      if (!key) continue;
      const group = byName.get(key) ?? [];
      group.push(row);
      byName.set(key, group);
    }
    const duplicates = [...byName.values()].filter((group) => group.length > 1);
    const missingDeveloper = rows.filter((row) => !row.developer_company_id && !row.spv_id);
    const missingDate = rows.filter((row) => !row.estimated_connection_date);
    const missingStatus = rows.filter((row) => !row.status);
    const missingTechnology = rows.filter((row) => !row.technology_id);
    const invalidCapacity = rows.filter((row) => (row.capacity_mw !== null && row.capacity_mw <= 0) || (row.capacity_mwh !== null && row.capacity_mwh <= 0));
    const example = (row: typeof rows[number]) => ({ id: row.id, name: row.name, projectPath: `/proyectos/${row.id}` });

    return {
      reviewed: rows.length,
      generatedAt: new Date().toISOString(),
      checks: {
        possibleDuplicateNames: { count: duplicates.length, examples: duplicates.slice(0, limit).map((group) => group.map(example)) },
        missingDeveloperOrSpv: { count: missingDeveloper.length, examples: missingDeveloper.slice(0, limit).map(example) },
        missingConnectionDate: { count: missingDate.length, examples: missingDate.slice(0, limit).map(example) },
        missingStatus: { count: missingStatus.length, examples: missingStatus.slice(0, limit).map(example) },
        missingTechnology: { count: missingTechnology.length, examples: missingTechnology.slice(0, limit).map(example) },
        invalidCapacity: { count: invalidCapacity.length, examples: invalidCapacity.slice(0, limit).map(example) },
      },
      methodology: "Reglas deterministas sobre proyectos publicados. Los nombres duplicados son candidatos y requieren revision humana.",
    };
  },
};
