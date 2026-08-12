// Borra los datos de prueba que entraron con la plantilla de ejemplo del
// Formulario. HOY ABORTA A PROPÓSITO: falta resolver las SPV, ver más abajo.
//
// Qué son: la plantilla en blanco del Formulario trae nombres de relleno
// ("Juan Pérez", "Empresa de Generación S.A.") y RUT de ejemplo
// (12.345.678-9, 76.123.456-7). Al procesarla como si fuera un documento real,
// esos valores quedaron cargados como contactos y empresas de producción, y un
// usuario Prime los ve como si fueran datos reales.
//
// POR QUÉ IDs FIJOS Y NO UN PATRÓN DE NOMBRE: buscar por `name ilike 'empresa
// de %'` también captura "Empresa de Transporte de Pasajeros Metro S.A.", que es
// Metro de Santiago y es una empresa real. Cualquier limpieza por patrón la
// habría borrado. Los ids se fijaron tras revisar caso por caso, y el script
// vuelve a verificar el nombre de cada uno antes de tocar nada: si algún id ya
// no corresponde a lo esperado, aborta sin borrar.
//
// ALCANCE REAL, medido contra producción el 2026-08-12. La versión anterior de
// esta cabecera decía "primeros días del proyecto (20-26 de julio)" y es falso:
//
//   - Las SPV con nombre de plantilla se siguieron creando hasta el 2026-08-10
//     (la última, en el reprocesamiento del 9-10 de agosto). Lo que las escribe
//     sigue vivo, así que limpiar sin tapar la fuente no dura.
//   - 49 filas de `spv` tienen una de estas empresas como matriz, y 30 proyectos
//     reales —4 de ellos verificados— cuelgan de esas SPV por `project.spv_id`,
//     que es ON DELETE NO ACTION. Por eso `--apply` moría con una violación de
//     `spv_parent_company_id_fkey` y revertía sin borrar nada.
//   - 3 de esas SPV son REALES: Bridge Almacenamiento Uno SpA, Bridge
//     Almacenamiento 2 SpA y CMS SPV III SpA. Tienen la sociedad correcta y la
//     matriz inventada: hay que soltarles la matriz, no borrarlas. Es el mismo
//     riesgo que motivó los ids fijos (Metro de Santiago), un nivel más abajo,
//     en `spv`, donde la primera versión no lo buscó.
//
// QUÉ FALTA, en este orden — invertirlo obliga a repetir el trabajo:
//   1. Tapar en la ingesta del Formulario lo que escribe los valores de la
//      plantilla, y rechazarlos en la escritura.
//   2. Resolver las 49 SPV: soltar el `spv_id` de sus proyectos y borrar las 46
//      inventadas; a las 3 reales, dejarlas sin matriz.
//   3. Recién entonces este script borra sus 13 filas sin chocar con nada.
//
// Uso:
//   node scripts/delete-template-test-data.mjs            # simulación
//   node scripts/delete-template-test-data.mjs --apply    # aplica
import { config } from "dotenv";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "pg";

const { Client } = pkg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
config({ path: join(repoRoot, ".env.local") });

const apply = process.argv.includes("--apply");

/** id -> nombre esperado. Se re-verifica antes de borrar. */
const COMPANIES = {
  "5f13b61c-e3f7-47c9-b107-6bef4c02b26e": "Empresa Chile S.A.",
  "bef15698-0ff0-4020-b8b6-5cbcbebb2337": "Empresa de Energía Renovable S.A.",
  "01464004-572b-4e5b-8c9c-af76ee151a39": "Empresa de Energía S.A.",
  "18c90d32-18dc-4e6e-9f42-6bd6a52f981a": "EMPRESA DE GENERACIÓN ELÉCTRICA S.A.",
  "6892548c-7db3-4618-9cc6-be5ebd821747": "EMPRESA DE GENERACIÓN ENERGÉTICA S.A.",
  "515ea94b-54f9-4ed4-8edf-009806702182": "Empresa de Generación S.A.",
};

const PERSONS = {
  "0a5698ee-5ef4-4c79-9478-c4b9eafa2d07": "Carlos Díaz",
  "3dcb3d7c-1651-4790-9efe-8cab1bea9de0": "Carlos Rojas",
  "4b411c9d-93ef-4a58-ad70-b29f93655354": "Juan Pérez",
  "297146f8-60dc-4920-b739-b377e4740b65": "Juan Pérez",
  "f3a5419e-160b-4c11-8b9a-a44b3a93e9ab": "María López",
  "bb61648d-7fe3-4de2-ac51-0da26cac0852": "María López",
};

const PROJECTS = {
  "092b9410-9e56-4761-b03a-c6fe17ca4b22": "PFV Prueba",
};

/** Control explícito: si alguno de estos apareciera en las listas, es un error grave. */
const NUNCA_BORRAR = ["e3e006da-494c-4e89-a3a9-fc7109e717be"]; // Metro de Santiago

async function verificar(client, tabla, columna, esperado) {
  const ids = Object.keys(esperado);
  const { rows } = await client.query(`select id, ${columna} as nombre from ${tabla} where id = any($1::uuid[])`, [ids]);
  if (rows.length !== ids.length) {
    throw new Error(`${tabla}: se esperaban ${ids.length} filas y se encontraron ${rows.length}. Abortado.`);
  }
  for (const row of rows) {
    if (row.nombre !== esperado[row.id]) {
      throw new Error(`${tabla} ${row.id}: se esperaba "${esperado[row.id]}" y hay "${row.nombre}". Abortado.`);
    }
  }
  return rows;
}

async function main() {
  const client = new Client({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT ?? 5432),
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: process.env.SUPABASE_DB_NAME ?? "postgres",
    ssl: { ca: readFileSync(join(repoRoot, "supabase", "certs", "supabase-root-2021-ca.pem"), "utf8") },
  });
  await client.connect();

  for (const id of NUNCA_BORRAR) {
    if (COMPANIES[id] || PERSONS[id] || PROJECTS[id]) throw new Error(`El id protegido ${id} aparece en la lista de borrado. Abortado.`);
  }

  await verificar(client, "company", "name", COMPANIES);
  await verificar(client, "person", "full_name", PERSONS);
  await verificar(client, "project", "name", PROJECTS);

  const companyIds = Object.keys(COMPANIES);
  const personIds = Object.keys(PERSONS);
  const projectIds = Object.keys(PROJECTS);
  const allIds = [...companyIds, ...personIds, ...projectIds];

  // Salvaguarda: ninguna de estas empresas debe ser desarrolladora de un proyecto real.
  const conProyectos = await client.query(
    "select count(*)::int as n from project where developer_company_id = any($1::uuid[])",
    [companyIds],
  );
  if (conProyectos.rows[0].n > 0) {
    throw new Error(`${conProyectos.rows[0].n} proyectos reales tienen una de estas empresas como desarrolladora. Abortado.`);
  }

  // Salvaguarda: ninguna de estas empresas debe ser matriz de una SPV.
  //
  // Va acá, entre las verificaciones y no dentro del `if (apply)`, porque la
  // simulación tiene que fallar en lo mismo que falla el borrado o no está
  // simulando nada: sin este chequeo la corrida sin `--apply` informaba éxito
  // para una operación que la base rechaza, y el `--apply` recién lo descubría
  // como una violación de FK cruda al fondo de un stack trace.
  const spvDependientes = await client.query(
    `select s.name, count(distinct p.id)::int as proyectos
       from spv s
       left join project p on p.spv_id = s.id
      where s.parent_company_id = any($1::uuid[])
      group by s.name
      order by proyectos desc, s.name`,
    [companyIds],
  );
  if (spvDependientes.rowCount > 0) {
    const proyectos = spvDependientes.rows.reduce((n, r) => n + r.proyectos, 0);
    const detalle = spvDependientes.rows.map((r) => `    - ${r.name}: ${r.proyectos} proyecto(s)`).join("\n");
    throw new Error(
      `${spvDependientes.rowCount} nombres de SPV tienen una de estas empresas como matriz, con ${proyectos} proyectos reales colgando de ellas. ` +
        `Resolver las SPV antes de borrar las empresas (ver la cabecera de este archivo). Abortado.\n${detalle}`,
    );
  }

  const relaciones = await client.query(
    "select * from entity_relationship where source_id = any($1::uuid[]) or target_id = any($1::uuid[])",
    [allIds],
  );

  // Respaldo previo: las filas borradas no dejan rastro.
  const logDir = join(repoRoot, "logs");
  mkdirSync(logDir, { recursive: true });
  const dumpPath = join(logDir, "delete-template-test-data-backup.json");
  const snapshot = {
    companies: (await client.query("select * from company where id = any($1::uuid[])", [companyIds])).rows,
    persons: (await client.query("select * from person where id = any($1::uuid[])", [personIds])).rows,
    projects: (await client.query("select * from project where id = any($1::uuid[])", [projectIds])).rows,
    relationships: relaciones.rows,
  };
  writeFileSync(dumpPath, JSON.stringify(snapshot, null, 2), "utf8");

  const resumen = {
    mode: apply ? "apply" : "dry-run",
    companies: companyIds.length,
    persons: personIds.length,
    projects: projectIds.length,
    relationships: relaciones.rowCount,
    backup: dumpPath,
  };

  if (apply) {
    await client.query("begin");
    try {
      const rel = await client.query(
        "delete from entity_relationship where source_id = any($1::uuid[]) or target_id = any($1::uuid[])",
        [allIds],
      );
      await client.query("delete from formulario_ingest_log where project_id = any($1::uuid[])", [projectIds]);

      const pr = await client.query("delete from project where id = any($1::uuid[])", [projectIds]);
      const pe = await client.query("delete from person where id = any($1::uuid[])", [personIds]);
      const co = await client.query("delete from company where id = any($1::uuid[])", [companyIds]);

      if (pr.rowCount !== projectIds.length || pe.rowCount !== personIds.length || co.rowCount !== companyIds.length) {
        throw new Error(
          `Conteos inesperados: proyectos ${pr.rowCount}/${projectIds.length}, personas ${pe.rowCount}/${personIds.length}, empresas ${co.rowCount}/${companyIds.length}. Rollback.`,
        );
      }

      await client.query("commit");
      Object.assign(resumen, {
        relationshipsDeleted: rel.rowCount,
        projectsDeleted: pr.rowCount,
        personsDeleted: pe.rowCount,
        companiesDeleted: co.rowCount,
      });
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }

  console.log(JSON.stringify(resumen, null, 2));
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
