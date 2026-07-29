import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: join(scriptDirectory, "..", ".env.local") });

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await client
    .from("project_preverification")
    .select("run_id, project_id, mode, status, created_at, report")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map((row) => {
    const report = row.report as {
      projectName?: string;
      fields?: Array<{ applied?: boolean; field?: string }>;
      errors?: string[];
    };
    return {
      runId: row.run_id,
      projectId: row.project_id,
      projectName: report.projectName,
      mode: row.mode,
      status: row.status,
      applied: report.fields?.filter((field) => field.applied).map((field) => field.field) ?? [],
      errors: report.errors ?? [],
      createdAt: row.created_at,
    };
  });
  const projectIds = [...new Set(rows.map((row) => row.projectId))];
  const { data: projects, error: projectError } = projectIds.length
    ? await client.from("project").select("id, name, verified_at, technology_id, capacity_mw, capacity_mwh, storage_hours").in("id", projectIds)
    : { data: [], error: null };
  if (projectError) throw new Error(projectError.message);
  console.log(JSON.stringify({ rows, projects }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
