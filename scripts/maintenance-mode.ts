// Prende, apaga o consulta el modo mantenimiento sin pasar por la UI.
//
// El interruptor de /admin es el camino normal. Este existe para el caso en que
// uno está en el VPS a mitad de una migración y no quiere abrir el navegador —
// o para dejarlo dentro de un script, antes y después de aplicar algo grande.
//
// Escribe la misma fila de `app_setting` que lee `lib/maintenance.ts`, así que
// los dos caminos no pueden divergir.
//
// Uso:
//   node_modules/.bin/tsx scripts/maintenance-mode.ts          # consulta
//   node_modules/.bin/tsx scripts/maintenance-mode.ts on       # corta el ingreso
//   node_modules/.bin/tsx scripts/maintenance-mode.ts off      # lo devuelve
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

import { createClient } from "@supabase/supabase-js";

const KEY = "maintenance_mode";
const accion = process.argv[2];

if (accion && accion !== "on" && accion !== "off") {
  console.error(`Argumento no reconocido: "${accion}". Use "on", "off", o nada para consultar.`);
  process.exit(1);
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  if (accion) {
    const { error } = await client
      .from("app_setting")
      .upsert({ key: KEY, value: accion === "on", updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  const { data, error } = await client.from("app_setting").select("value, updated_at").eq("key", KEY).maybeSingle();
  if (error) throw new Error(error.message);

  const encendido = data?.value === true;
  console.log(
    JSON.stringify(
      {
        modoMantenimiento: encendido ? "encendido" : "apagado",
        efecto: encendido
          ? "Los clientes ven el aviso en /ingresar y no pueden entrar. El acceso de admin (/admin/acceso) sigue abierto."
          : "Ingreso normal para todos.",
        actualizado: data?.updated_at ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
