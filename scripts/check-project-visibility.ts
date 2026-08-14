// Pregunta qué proyectos ve un cliente, y falla si la respuesta cambió.
//
// POR QUÉ EXISTE: el 2026-07-29 el filtro por tecnología de `project`
// desapareció dentro de un `drop policy` + `create policy` con el mismo nombre.
// No hubo error ni conflicto — la condición vieja simplemente dejó de estar, y
// durante dos semanas cualquier cliente pudo ver proyectos de consumo y una
// termoeléctrica. Se descubrió de casualidad. Una policy que se reemplaza no
// avisa qué condiciones se perdieron; esto lo pregunta todos los días.
//
// CÓMO PREGUNTA: se conecta por Postgres y hace `set local role authenticated`
// antes de consultar. No reimplementa el filtro ni lee `pg_policies` para
// compararlo con un texto esperado: le pide las filas a la base como se las
// pediría un cliente, que es lo único que no se puede desincronizar de la
// realidad. Un chequeo que reimplementa la regla que quiere vigilar se rompe
// junto con ella.
//
// QUÉ AFIRMA:
//   1. Ningún proyecto caído es visible.
//   2. Ninguna tecnología excluida es visible.
//   3. Ningún nombre de los patrones excluidos es visible.
//   4. La generación menor (geotérmica, biomasa, hidro, bombeo) SIGUE visible.
//      Este no es decorativo: `unaccent('geotérmica')` contiene la subcadena
//      "termica", así que un patrón térmico sin límites de palabra esconde la
//      geotermia. Ya pasó en el borrador de la migración.
//   5. Queda algo visible. Una policy que esconde todo también "pasa" los
//      cuatro anteriores.
//
// Uso:
//   node_modules/.bin/tsx scripts/check-project-visibility.ts
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

import { Client } from "pg";
import { createSupabaseServiceClient } from "../lib/data-access/supabase-service-client";
import { finishCronRun, startCronRun } from "../lib/data-access/cronRunLog";

const JOB_NAME = "check-project-visibility";

const TECNOLOGIAS_OCULTAS = ["transmission", "thermal", "data_center", "consumption"];
const TECNOLOGIAS_QUE_DEBEN_VERSE = ["geothermal", "biomass", "hydro", "pumped_hydro"];
const PATRON_NOMBRES_OCULTOS =
  "subestacion|linea de transmision|alimentador|seccionador|seccionamiento|transformador" +
  "|\\mminera\\M|\\mmineria\\M|\\mminero\\M" +
  "|desaladora|desalinizadora|desalacion|desalinizacion" +
  "|\\mtermica\\M|\\mtermicas\\M|\\mtermico\\M|\\mtermicos\\M" +
  "|\\mtermoelectrica\\M|\\mtermoelectricas\\M|\\mtermoelectrico\\M|\\mtermoelectricos\\M" +
  "|data center|datacenter|centro de datos";

interface Hallazgo {
  regla: string;
  esperado: string;
  encontrado: number;
  ejemplos: string[];
}

async function main() {
  const pg = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { ca: readFileSync(join(repoRoot, "supabase", "certs", "supabase-root-2021-ca.pem"), "utf8") },
  });
  const service = createSupabaseServiceClient();
  const run = await startCronRun(service, JOB_NAME);

  try {
    await pg.connect();

    /** Consulta lo mismo que vería un cliente autenticado, no lo que ve el dueño de la tabla. */
    async function comoCliente<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      await pg.query("begin");
      try {
        await pg.query("set local role authenticated");
        const { rows } = await pg.query(sql, params);
        return rows as T[];
      } finally {
        await pg.query("rollback");
      }
    }

    const hallazgos: Hallazgo[] = [];
    const revisar = async (regla: string, esperado: string, sql: string, params: unknown[] = []) => {
      const rows = await comoCliente<{ name: string }>(sql, params);
      if (rows.length > 0) {
        hallazgos.push({ regla, esperado, encontrado: rows.length, ejemplos: rows.slice(0, 5).map((r) => r.name) });
      }
      return rows.length;
    };

    await revisar(
      "proyectos caidos",
      "0 visibles",
      `select name from project where status in ('Rechazada','Desistida')`,
    );
    await revisar(
      "tecnologias excluidas",
      "0 visibles",
      `select p.name from project p join technology t on t.id = p.technology_id where t.code = any($1)`,
      [TECNOLOGIAS_OCULTAS],
    );
    await revisar(
      "nombres excluidos",
      "0 visibles",
      `select name from project where unaccent(lower(name)) ~ $1`,
      [PATRON_NOMBRES_OCULTOS],
    );

    const generacionMenor = await comoCliente<{ n: string }>(
      `select count(*)::int n from project p join technology t on t.id = p.technology_id where t.code = any($1)`,
      [TECNOLOGIAS_QUE_DEBEN_VERSE],
    );
    const visiblesGeneracionMenor = Number(generacionMenor[0]?.n ?? 0);
    if (visiblesGeneracionMenor === 0) {
      hallazgos.push({
        regla: "generacion menor",
        esperado: "> 0 visibles (geotermica, biomasa, hidro, bombeo)",
        encontrado: 0,
        ejemplos: ["revisar los limites de palabra del patron termico: 'geotermica' contiene 'termica'"],
      });
    }

    const totales = await comoCliente<{ n: string }>(`select count(*)::int n from project`);
    const visibles = Number(totales[0]?.n ?? 0);
    if (visibles === 0) {
      hallazgos.push({ regla: "catalogo visible", esperado: "> 0 proyectos", encontrado: 0, ejemplos: [] });
    }

    const resumen = { visibles, visiblesGeneracionMenor, hallazgos };
    console.log(JSON.stringify(resumen, null, 2));

    await finishCronRun(service, run, {
      status: hallazgos.length ? "error" : "success",
      eligible_rows: visibles,
      events_failed: hallazgos.length,
      error_message: hallazgos.length ? `${hallazgos.length} regla(s) de visibilidad incumplidas` : null,
      metadata: resumen,
    });

    if (hallazgos.length) {
      console.error(`\n${hallazgos.length} regla(s) de visibilidad incumplidas. Ver arriba.`);
      process.exitCode = 1;
    }
  } catch (err) {
    await finishCronRun(service, run, { status: "error", error_message: (err as Error).message || "Error sin mensaje" });
    throw err;
  } finally {
    await pg.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
