import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { computeEstimatedPhase } from "../lib/shared/computeEstimatedPhase";
import { getScheduleGroup, PHASE_TO_GROUP } from "../lib/shared/projectPhaseDurations";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: project } = await client
    .from("project")
    .select("id, name, status, estimated_connection_date, capacity_mw, includes_storage, technology:technology_id(code)")
    .eq("id", "3c6ca2d6-03da-4f88-ad2d-ff3de15bf38f")
    .single();
  console.log(JSON.stringify(project, null, 2));

  const tech = (project?.technology as unknown as { code: string } | null)?.code ?? null;
  const group = getScheduleGroup(tech, project!.includes_storage, project!.capacity_mw);
  console.log("\nScheduleGroup actual:", group);
  const phase = computeEstimatedPhase(project!.estimated_connection_date, tech, project!.includes_storage, project!.capacity_mw);
  console.log("Fase actual computada:", phase?.currentPhase, "-> grupo:", phase?.currentPhase ? PHASE_TO_GROUP[phase.currentPhase] : null);

  // Simular con technology='bess'
  const phaseBess = computeEstimatedPhase(project!.estimated_connection_date, "bess", project!.includes_storage, project!.capacity_mw);
  console.log("\nSi technology='bess' -> fase:", phaseBess?.currentPhase, "-> grupo:", phaseBess?.currentPhase ? PHASE_TO_GROUP[phaseBess.currentPhase] : null);
}
main().catch((e) => console.error(e));
