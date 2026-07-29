import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { REJECTED_STATUSES, startOfCurrentMonthIso } from "../lib/data-access/projects";

config({ path: ".env.local" });

const serviceRoleFetch: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  if (headers.get("authorization")?.startsWith("Bearer sb_secret_")) {
    headers.delete("authorization");
  }
  return fetch(input, { ...init, headers });
};

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: serviceRoleFetch },
  });
  const [{ data: current, error: currentError }, { data: successful, error: successfulError }] = await Promise.all([
    client
      .from("project")
      .select("id")
      .is("verified_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfCurrentMonthIso())
      .limit(1000),
    client
      .from("project_preverification")
      .select("project_id")
      .eq("mode", "apply")
      .in("status", ["completed", "partial"])
      .limit(5000),
  ]);
  if (currentError) throw currentError;
  if (successfulError) throw successfulError;
  const successfulIds = new Set((successful ?? []).map((row) => row.project_id as string));
  const completedCurrent = (current ?? []).filter((row) => successfulIds.has(row.id as string)).length;
  console.log(JSON.stringify({
    processRunning: false,
    currentPendingHumanVerification: current?.length ?? 0,
    preverifiedCurrent: completedCurrent,
    remainingPreverification: (current?.length ?? 0) - completedCurrent,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
