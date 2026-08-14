import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const on = process.argv[2] === "on";
const { error } = await c.from("app_setting").upsert({ key: "maintenance_mode", value: on, updated_at: new Date().toISOString() });
if (error) { console.error(error.message); process.exit(1); }
const { data } = await c.from("app_setting").select("key,value").eq("key", "maintenance_mode").maybeSingle();
console.log("maintenance_mode =", data?.value);
