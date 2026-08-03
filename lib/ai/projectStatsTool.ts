import type { SupabaseClient } from "@supabase/supabase-js";
import { REJECTED_STATUSES, startOfCurrentMonthIso } from "@/lib/data-access/projects";

// Códigos válidos de project.technology.code (ver app/(public)/components/techChips.ts).
const TECHNOLOGY_CODES = ["solar_pv", "wind", "hydro", "pumped_hydro", "bess", "hybrid", "biomass", "geothermal"] as const;
type TechnologyCode = (typeof TECHNOLOGY_CODES)[number];

const METRICS = ["count", "avg_storage_hours", "sum_capacity_mw", "avg_capacity_mw"] as const;
type Metric = (typeof METRICS)[number];

const GROUP_BY = ["none", "region", "technology"] as const;
type GroupBy = (typeof GROUP_BY)[number];

export const PROJECT_STATS_TOOL_NAME = "query_project_stats";

/**
 * Única herramienta que puede invocar el chat de IA para leer datos reales de
 * Supabase — a propósito una consulta agregada y parametrizada (whitelist de
 * enums), no SQL libre, para no exponer la base a generación de queries.
 */
export const PROJECT_STATS_TOOL = {
  type: "function" as const,
  function: {
    name: PROJECT_STATS_TOOL_NAME,
    description:
      "Consulta estadísticas de la misma cartera editorial visible en Proyectos futuros de Transition LATAM: proyectos verificados, vigentes, con conexión desde el mes actual y tecnologías renovables o almacenamiento.",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          enum: METRICS,
          description:
            "count = cantidad de proyectos. sum_capacity_mw = suma de capacidad MW. avg_capacity_mw = capacidad MW promedio. avg_storage_hours = horas de almacenamiento promedio (solo aplica a proyectos con almacenamiento, ej. BESS).",
        },
        technologyCode: {
          type: "string",
          enum: [...TECHNOLOGY_CODES, "all"],
          description: "Filtra por tecnología. 'bess' para proyectos de almacenamiento. 'all' para todas.",
        },
        groupBy: {
          type: "string",
          enum: GROUP_BY,
          description: "Agrupa el resultado por región o tecnología. 'none' para un solo total.",
        },
        onlyActive: {
          type: "boolean",
          description: "Si es true (default), excluye proyectos Rechazados/Desistidos — es decir, solo proyectos vigentes/en proceso.",
        },
      },
      required: ["metric"],
    },
  },
};

interface ProjectStatsArgs {
  metric: Metric;
  technologyCode?: TechnologyCode | "all";
  groupBy?: GroupBy;
  onlyActive?: boolean;
}

function parseArgs(raw: unknown): ProjectStatsArgs {
  const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!obj || typeof obj !== "object") throw new Error("Argumentos inválidos");
  const metric = (obj as Record<string, unknown>).metric;
  if (typeof metric !== "string" || !METRICS.includes(metric as Metric)) throw new Error("metric inválido");
  const technologyCode = (obj as Record<string, unknown>).technologyCode;
  const groupBy = (obj as Record<string, unknown>).groupBy;
  const onlyActive = (obj as Record<string, unknown>).onlyActive;
  return {
    metric: metric as Metric,
    technologyCode:
      typeof technologyCode === "string" && (TECHNOLOGY_CODES.includes(technologyCode as TechnologyCode) || technologyCode === "all")
        ? (technologyCode as TechnologyCode | "all")
        : "all",
    groupBy: typeof groupBy === "string" && GROUP_BY.includes(groupBy as GroupBy) ? (groupBy as GroupBy) : "none",
    onlyActive: typeof onlyActive === "boolean" ? onlyActive : true,
  };
}

interface ProjectRow {
  capacity_mw: number | null;
  storage_hours: number | null;
  technology: { code: string | null } | null;
  location: { region: { name: string | null } | null } | null;
}

async function fetchRows(client: SupabaseClient, args: ProjectStatsArgs): Promise<ProjectRow[]> {
  const filterByTechnology = Boolean(args.technologyCode && args.technologyCode !== "all");
  const select =
    "capacity_mw, storage_hours, technology:technology_id!inner(code), location:location_id(region:region_id(name))";

  const rows: ProjectRow[] = [];
  for (let from = 0; ; from += 1000) {
    // Consulta exclusivamente de lectura sobre `project`; todos los campos,
    // métricas y agrupaciones provienen de listas cerradas definidas arriba.
    const query = client
      .from("project")
      .select(select)
      .not("verified_at", "is", null)
      .gte("estimated_connection_date", startOfCurrentMonthIso())
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`);
    const { data, error } = filterByTechnology
      ? await query.eq("technology.code", args.technologyCode as string).range(from, from + 999)
      : await query.in("technology.code", [...TECHNOLOGY_CODES]).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as ProjectRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function computeMetric(rows: ProjectRow[], metric: Metric): number | null {
  if (metric === "count") return rows.length;
  if (metric === "sum_capacity_mw") return rows.reduce((sum, r) => sum + (r.capacity_mw ?? 0), 0);
  if (metric === "avg_capacity_mw") {
    const valid = rows.filter((r) => r.capacity_mw !== null);
    return valid.length ? valid.reduce((sum, r) => sum + (r.capacity_mw ?? 0), 0) / valid.length : null;
  }
  // avg_storage_hours
  const valid = rows.filter((r) => r.storage_hours !== null && r.storage_hours > 0);
  return valid.length ? valid.reduce((sum, r) => sum + (r.storage_hours ?? 0), 0) / valid.length : null;
}

export async function runProjectStatsQuery(client: SupabaseClient, rawArgs: unknown): Promise<Record<string, unknown>> {
  const args = parseArgs(rawArgs);
  const rows = await fetchRows(client, args);

  if (args.groupBy === "none") {
    return {
      metric: args.metric,
      technologyCode: args.technologyCode,
      onlyActive: args.onlyActive,
      sampleSize: rows.length,
      value: computeMetric(rows, args.metric),
      scope: "Cartera visible en Proyectos futuros",
    };
  }

  const groups = new Map<string, ProjectRow[]>();
  for (const row of rows) {
    const key = args.groupBy === "region" ? (row.location?.region?.name ?? "Sin región") : (row.technology?.code ?? "Sin tecnología");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  return {
    metric: args.metric,
    technologyCode: args.technologyCode,
    onlyActive: args.onlyActive,
    groupBy: args.groupBy,
    results: [...groups.entries()]
      .map(([key, groupRows]) => ({ group: key, sampleSize: groupRows.length, value: computeMetric(groupRows, args.metric) }))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    scope: "Cartera visible en Proyectos futuros",
  };
}
