import type { Metadata } from "next";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { listProjects } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { SearchBar } from "../../components/SearchBar";
import { Pager } from "../../components/Pager";
import { Panel } from "../../components/Panel";
import { AdminProjectListTable } from "../components/AdminProjectListTable";

export const metadata: Metadata = { title: "Editar data" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SORT_COLUMNS = ["name", "capacityMw"] as const;
type SortColumn = (typeof SORT_COLUMNS)[number];

function isSortColumn(value: string | undefined): value is SortColumn {
  return !!value && (SORT_COLUMNS as readonly string[]).includes(value);
}

export default async function EditarDataPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const sortBy = isSortColumn(params.sort) ? params.sort : undefined;
  const sortDir = params.dir === "desc" ? "desc" : "asc";
  // service_role tras validar isAdmin(): la sesión de admin es una cookie
  // propia, no de Supabase, así que con el cliente de sesión esta página
  // consulta como `anon` y desde que anon quedó cerrado devolvía 0 proyectos.
  const client = createSupabaseServiceClient();
  const result = await listProjects(client, { search: params.q, sortBy, sortDir }, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(overrides: Record<string, string | undefined>): string {
    const merged = { q: params.q, page: params.page, sort: params.sort, dir: params.dir, ...overrides };
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) qs.set(key, value);
    }
    const query = qs.toString();
    return query ? `/admin/editar-data?${query}` : "/admin/editar-data";
  }

  function buildSortHref(column: string, direction: "asc" | "desc"): string {
    return buildHref({ sort: column, dir: direction, page: undefined });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Editar data</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {result.totalCount.toLocaleString("es-CL")} proyectos — busca cualquiera para corregir sus datos.
        </p>
      </div>
      <SearchBar
        basePath="/admin/editar-data"
        value={params.q}
        otherParams={{}}
        placeholder="Buscar por nombre de proyecto..."
      />
      <Panel className="flex flex-col gap-4">
        <AdminProjectListTable items={result.items} sortBy={sortBy} sortDir={sortDir} buildSortHref={buildSortHref} />
        <Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: String(p) })} />
      </Panel>
    </div>
  );
}
