import type { SupabaseClient } from "@supabase/supabase-js";
import { REJECTED_STATUSES, startOfCurrentMonthIso } from "@/lib/data-access/projects";
import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";
import { PHASE_GROUP_LABELS, PHASE_TO_GROUP } from "@/lib/shared/projectPhaseDurations";

const TECHNOLOGY_CODES = ["solar_pv", "wind", "hydro", "pumped_hydro", "bess", "hybrid", "biomass", "geothermal"] as const;
type TechnologyCode = (typeof TECHNOLOGY_CODES)[number];

export const PROJECT_SEARCH_TOOL_NAME = "search_projects";

export const PROJECT_SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: PROJECT_SEARCH_TOOL_NAME,
    description:
      "Busca exclusivamente en la cartera editorial visible de Proyectos futuros de Transition LATAM: proyectos verificados, vigentes, con fecha desde el mes actual y tecnologías renovables o almacenamiento. Devuelve los mismos datos principales y la etapa estimada que usa la plataforma.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Parte del nombre del proyecto. Omítelo si la búsqueda es solo por empresa, región o tecnología.",
        },
        developer: {
          type: "string",
          description: "Parte del nombre de la empresa desarrolladora o titular.",
        },
        region: {
          type: "string",
          description: "Parte del nombre de la región.",
        },
        technologyCode: {
          type: "string",
          enum: [...TECHNOLOGY_CODES, "all"],
          description: "Código de tecnología; usa 'all' si no corresponde filtrar.",
        },
        onlyActive: {
          type: "boolean",
          description: "Debe ser true. La vista pública solo incluye proyectos vigentes y futuros.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Cantidad máxima de resultados, entre 1 y 10.",
        },
      },
    },
  },
};

interface SearchArgs {
  query?: string;
  developer?: string;
  region?: string;
  technologyCode?: TechnologyCode | "all";
  onlyActive: boolean;
  limit: number;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.trim().slice(0, 120);
  return clean || undefined;
}

function parseArgs(raw: unknown): SearchArgs {
  const value = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!value || typeof value !== "object") throw new Error("Argumentos inválidos");
  const record = value as Record<string, unknown>;
  const technology = record.technologyCode;
  const requestedLimit = typeof record.limit === "number" ? Math.trunc(record.limit) : 6;
  return {
    query: cleanText(record.query),
    developer: cleanText(record.developer),
    region: cleanText(record.region),
    technologyCode:
      typeof technology === "string" && (TECHNOLOGY_CODES.includes(technology as TechnologyCode) || technology === "all")
        ? technology as TechnologyCode | "all"
        : "all",
    onlyActive: record.onlyActive !== false,
    limit: Math.min(10, Math.max(1, requestedLimit)),
  };
}

export async function runProjectSearch(client: SupabaseClient, rawArgs: unknown): Promise<Record<string, unknown>> {
  const args = parseArgs(rawArgs);
  const currentMonthStart = startOfCurrentMonthIso();
  const developerJoin = args.developer ? "!inner" : "";
  const locationJoin = args.region ? "!inner" : "";
  const technologyJoin = "!inner";
  const select = [
    "id",
    "name",
    "internal_code",
    "status",
    "verified_at",
    "estimated_connection_date",
    "capacity_mw",
    "capacity_mwh",
    "generation_capacity_mw",
    "storage_capacity_mw",
    "storage_hours",
    "includes_storage",
    "project_kind",
    `technology:technology_id${technologyJoin}(name,code)`,
    `location:location_id${locationJoin}(comuna,region:region_id(name))`,
    `developer:developer_company_id${developerJoin}(name)`,
    "spv:spv_id(name)",
  ].join(",");

  // Esta herramienta es deliberadamente read-only y solo consulta `project`
  // con relaciones públicas de su ficha. No acepta nombres de tabla/columna
  // del modelo ni expone una vía para mutaciones o SQL generado.
  let query = client.from("project").select(select);
  if (args.query) query = query.ilike("name", `%${args.query}%`);
  if (args.developer) query = query.ilike("developer.name", `%${args.developer}%`);
  if (args.region) query = query.ilike("location.region.name", `%${args.region}%`);
  query = query
    .not("verified_at", "is", null)
    .gte("estimated_connection_date", currentMonthStart)
    .not("status", "ilike", "%finalizad%")
    .in("technology.code", [...TECHNOLOGY_CODES]);
  if (args.technologyCode && args.technologyCode !== "all") query = query.eq("technology.code", args.technologyCode);
  if (args.onlyActive) query = query.not("status", "in", `(${REJECTED_STATUSES.join(",")})`);

  const { data, error } = await query
    .order("estimated_connection_date", { ascending: true, nullsFirst: false })
    .limit(args.limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  return {
    filters: args,
    count: rows.length,
    projects: rows.map((row) => {
      const technology = row.technology as unknown as { name?: string | null; code?: string | null } | null;
      const location = row.location as unknown as { comuna?: string | null; region?: { name?: string | null } | null } | null;
      const developer = row.developer as unknown as { name?: string | null } | null;
      const spv = row.spv as unknown as { name?: string | null } | null;
      const estimatedPhase = computeEstimatedPhase(
        row.estimated_connection_date as string | null,
        technology?.code ?? null,
        Boolean(row.includes_storage),
        row.capacity_mw as number | null,
      );
      const phaseGroup = estimatedPhase?.currentPhase ? PHASE_TO_GROUP[estimatedPhase.currentPhase] : null;
      return {
        id: row.id,
        name: row.name,
        internalCode: row.internal_code,
        status: row.status,
        estimatedConnectionDate: row.estimated_connection_date,
        estimatedDevelopmentStage: phaseGroup ? PHASE_GROUP_LABELS[phaseGroup] : "Desarrollo temprano",
        stageSource: "Estimación de Transition LATAM basada en el cronograma del proyecto; no es un hito oficial",
        capacityMw: row.capacity_mw,
        capacityMwh: row.capacity_mwh,
        generationCapacityMw: row.generation_capacity_mw,
        storageCapacityMw: row.storage_capacity_mw,
        storageHours: row.storage_hours,
        includesStorage: row.includes_storage,
        projectKind: row.project_kind,
        technology: technology?.name ?? null,
        technologyCode: technology?.code ?? null,
        region: location?.region?.name ?? null,
        comuna: location?.comuna ?? null,
        developer: developer?.name ?? null,
        spv: spv?.name ?? null,
        projectPath: `/proyectos/${String(row.id)}`,
      };
    }),
    scope:
      `Proyectos Futuros: fichas verificadas de iniciativas identificadas aún en desarrollo, vigentes y con fecha estimada de conexión desde ${currentMonthStart}; incluye generación renovable y almacenamiento, y excluye proyectos históricos, rechazados, desistidos, transmisión y generación térmica.`,
  };
}
