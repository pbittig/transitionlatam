import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: bessTech } = await client.from("technology").select("id").eq("code", "bess").single();
  const { error } = await client
    .from("project")
    .update({ technology_id: bessTech!.id })
    .eq("id", "3c6ca2d6-03da-4f88-ad2d-ff3de15bf38f");
  if (error) throw error;
  console.log("CRCA BESS Tamango: technology_id asignado a BESS.");
}
main().catch((e) => console.error(e));
