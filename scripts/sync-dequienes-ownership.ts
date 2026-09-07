/**
 * Carga la relación societaria de las sociedades detrás de los proyectos
 * vigentes, desde la API de dequienes.cl.
 *
 * QUÉ BUSCA: quién es dueño de qué. El porcentaje se guarda cuando la fuente lo
 * publica, pero no es condición para registrar el vínculo — hay aristas reales
 * del Diario Oficial que vienen sin él, y perder la relación entera por eso
 * sería cambiar el dato principal por el secundario.
 *
 * QUÉ NO HACE: no infiere. Si la fuente no registra dueño, la sociedad queda
 * sin mapa y eso se informa; no se completa con el nombre parecido ni con el
 * grupo económico.
 *
 * EL CORTE Y POR QUÉ: se piden las relaciones a distancia 1 y se guardan las
 * participaciones sobre UMBRAL_REGISTRO. A distancia mayor, en una sociedad
 * abierta aparecen cientos de aristas hacia bancos, corredoras y AFP con
 * participaciones bajo el 1% — free float que no dice quién controla y que
 * cuesta un crédito por nombre. Ver lib/ingestion/sources/dequienes/normalize.
 *
 * Por defecto corre EN SECO: muestra qué escribiría y no toca la base.
 *
 *   npx tsx scripts/sync-dequienes-ownership.ts --limite 6
 *   npx tsx scripts/sync-dequienes-ownership.ts --rut 76567718
 *   npx tsx scripts/sync-dequienes-ownership.ts --limite 20 --aplicar
 */

import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DequienesClient } from "../lib/ingestion/sources/dequienes/fetch";
import {
  construirCadena,
  UMBRAL_CONTROL,
  UMBRAL_REGISTRO,
  type CadenaPropiedad,
  type EntidadCadena,
} from "../lib/ingestion/sources/dequienes/normalize";
import { rutParaApi, rutEsValido } from "../lib/ingestion/sources/dequienes/rut";
import { normalizeRutDigits } from "../lib/ingestion/sources/sea-pertinencia/matching";
import { buildVigenciaPredicate } from "../lib/data-access/projects";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const args = process.argv.slice(2);
const valor = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const LIMITE = Number(valor("--limite") ?? 5);
const RUT_UNICO = valor("--rut");
const APLICAR = args.includes("--aplicar");
/**
 * Un nivel alcanza para la matriz directa, que es el dato comercial, y entra en
 * el presupuesto de créditos; dos niveles lo duplican largo. Ver el resumen de
 * costo al final de la corrida.
 */
const NIVELES = Number(valor("--nivel") ?? 1);
// Las sociedades más grandes tienen cadenas más caras que la mediana: tomar las
// primeras sobreestima el costo total. El muestreo parejo da una proyección real.
const TOPE_DE_LA_LISTA = args.includes("--top");

/** Etiqueta legible del registro del que salió la arista. */
const FUENTES: Record<string, string> = {
  SII_REC_COM: "Registro de comercio (SII)",
  CMF: "Registro de accionistas (CMF)",
  DO: "Diario Oficial",
  DOH: "Diario Oficial",
  RES: "Resolución administrativa",
};
const etiquetaFuente = (codigo: string | null) =>
  codigo ? (FUENTES[codigo] ?? `Registro público (${codigo})`) : "Registro público";

const ETIQUETA_PERFIL = "Relaciones societarias de registros públicos, vía dequienes.cl";

async function leerTodo<T>(client: SupabaseClient, tabla: string, select: string): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await client.from(tabla).select(select).range(desde, desde + 999);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return filas;
}

interface Empresa {
  id: string;
  nombre: string;
  rut: string;
  apiRut: string;
  proyectos: { id: string; name: string }[];
}

/**
 * Escribe la cadena. Nada de lo que ya existe se sobrescribe: los mapas
 * cargados a mano para los proyectos piloto tienen nombres cuidados y
 * porcentajes validados, y la API devuelve razones sociales en mayúscula y sin
 * acentos. Ante un choque, gana lo que ya está.
 */
async function aplicarCadena(
  client: SupabaseClient,
  empresa: Empresa,
  cadena: CadenaPropiedad,
  idPorRut: Map<string, string>,
  perfilesExistentes: Set<string>,
): Promise<{ entidades: number; relaciones: number; perfiles: number }> {
  let entidadesCreadas = 0;

  const idDe = async (entidad: EntidadCadena): Promise<string> => {
    const clave = normalizeRutDigits(entidad.rut)!;
    const existente = idPorRut.get(clave);
    if (existente) return existente;
    // El nombre de la raíz sale de nuestra base, que lo tiene con mayúsculas y
    // acentos correctos; el resto viene de la API tal cual lo publica el registro.
    const nombre = entidad.nivel === 0 ? empresa.nombre : entidad.nombre;
    if (!nombre) throw new Error(`Sin nombre para ${entidad.rut}; no se puede crear la entidad`);
    const { data, error } = await client
      .from("ownership_entity")
      .insert({
        legal_name: nombre,
        rut: entidad.rut,
        entity_type: entidad.tipo,
        country_code: entidad.tipo === "foreign_company" ? null : "CL",
      })
      .select("id")
      .single();
    if (error) throw new Error(`ownership_entity ${entidad.rut}: ${error.message}`);
    idPorRut.set(clave, data.id as string);
    entidadesCreadas += 1;
    return data.id as string;
  };

  let relacionesCreadas = 0;
  for (const rel of cadena.relaciones) {
    const dueno = cadena.entidades.find((e) => e.rutNumerico === rel.duenoRut);
    const poseido = cadena.entidades.find((e) => e.rutNumerico === rel.poseidoRut);
    if (!dueno || !poseido) continue;
    const ownerId = await idDe(dueno);
    const ownedId = await idDe(poseido);
    const { error } = await client.from("ownership_relation").upsert(
      {
        owner_entity_id: ownerId,
        owned_entity_id: ownedId,
        ownership_percent: rel.porcentaje,
        source_label: etiquetaFuente(rel.fuente),
        source_date: rel.fechaFuente,
      },
      { onConflict: "owner_entity_id,owned_entity_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(`ownership_relation ${rel.duenoRut}->${rel.poseidoRut}: ${error.message}`);
    relacionesCreadas += 1;
  }

  const raiz = cadena.entidades.find((e) => e.nivel === 0);
  if (!raiz) return { entidades: entidadesCreadas, relaciones: relacionesCreadas, perfiles: 0 };
  const spvId = await idDe(raiz);

  // Solo se recorrió hasta NIVELES: mientras quede un controlador sin explorar,
  // la cobertura es parcial y la ficha debe decirlo.
  const cobertura = cadena.truncada ? "partial" : "complete";
  const fechas = cadena.relaciones
    .map((r) => r.fechaFuente)
    .filter((f): f is string => !!f)
    .sort();
  const nuevos = empresa.proyectos.filter((p) => !perfilesExistentes.has(p.id));
  if (nuevos.length) {
    const { error } = await client.from("project_ownership_profile").insert(
      nuevos.map((p) => ({
        project_id: p.id,
        spv_entity_id: spvId,
        coverage_status: cobertura,
        source_label: ETIQUETA_PERFIL,
        source_date: fechas.at(-1) ?? null,
      })),
    );
    if (error) throw new Error(`project_ownership_profile ${empresa.nombre}: ${error.message}`);
    nuevos.forEach((p) => perfilesExistentes.add(p.id));
  }

  return { entidades: entidadesCreadas, relaciones: relacionesCreadas, perfiles: nuevos.length };
}

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const api = new DequienesClient({ apiKey: process.env.DEQUIENES_API_KEY! });

  const antes = await api.creditos();
  console.log(APLICAR ? "MODO ESCRITURA" : "CORRIDA EN SECO — no se escribe nada");
  console.log(`Créditos: ${antes.consumed_credits} usados de ${antes.request_cap}\n`);

  const esVigente = await buildVigenciaPredicate(supabase);
  type P = {
    id: string;
    name: string;
    status: string | null;
    estimated_connection_date: string | null;
    developer_company_id: string | null;
  };
  const vigentes = (
    await leerTodo<P>(supabase, "project", "id,name,status,estimated_connection_date,developer_company_id")
  ).filter(esVigente);
  const empresasBase = new Map(
    (await leerTodo<{ id: string; name: string; rut: string | null }>(supabase, "company", "id,name,rut")).map((e) => [
      e.id,
      e,
    ]),
  );

  // El crédito se gasta por sociedad, no por proyecto: varios proyectos vigentes
  // comparten desarrolladora. La clave es el RUT y no company.id porque la misma
  // sociedad puede estar repetida en `company` — el RUT manda sobre el nombre —
  // y consultarla dos veces sería pagar dos veces la misma cadena.
  const porEmpresa = new Map<string, Empresa>();
  for (const p of vigentes) {
    const emp = p.developer_company_id ? empresasBase.get(p.developer_company_id) : null;
    if (!emp?.rut) continue;
    const apiRut = rutParaApi(emp.rut);
    if (!apiRut || !rutEsValido(emp.rut)) continue;
    const actual = porEmpresa.get(apiRut) ?? { id: emp.id, nombre: emp.name, rut: emp.rut, apiRut, proyectos: [] };
    actual.proyectos.push({ id: p.id, name: p.name });
    porEmpresa.set(apiRut, actual);
  }

  const entidadesExistentes = await leerTodo<{ id: string; rut: string | null; legal_name: string | null }>(
    supabase,
    "ownership_entity",
    "id,rut,legal_name",
  );
  const idPorRut = new Map<string, string>();
  for (const e of entidadesExistentes) {
    const clave = normalizeRutDigits(e.rut);
    if (clave) idPorRut.set(clave, e.id);
  }
  const perfilesExistentes = new Set(
    (await leerTodo<{ project_id: string }>(supabase, "project_ownership_profile", "project_id")).map(
      (p) => p.project_id,
    ),
  );

  // Cada nombre que ya tenemos es un crédito que no se gasta. Entran los de
  // `company` y también los de `ownership_entity`, que guardan lo resuelto en
  // corridas anteriores — la matriz de un SPV ya consultado no se paga de nuevo.
  const nombresConocidos = new Map<string, string>();
  for (const emp of empresasBase.values()) {
    const apiRut = rutParaApi(emp.rut);
    if (apiRut && emp.name) nombresConocidos.set(apiRut, emp.name);
  }
  for (const e of entidadesExistentes) {
    const apiRut = rutParaApi(e.rut);
    if (apiRut && e.legal_name) nombresConocidos.set(apiRut, e.legal_name);
  }

  let candidatas = [...porEmpresa.values()];
  if (RUT_UNICO) {
    // Acepta el RUT completo ("77.806.899-0") o solo la parte numérica
    // ("77806899", el formato de la API). rutParaApi asume que el último
    // carácter es el verificador, así que a la forma numérica no se le aplica.
    const limpio = RUT_UNICO.toUpperCase().replace(/[^0-9K]/g, "");
    const buscado = /[K]$/.test(limpio) || RUT_UNICO.includes("-") ? rutParaApi(RUT_UNICO) : String(Number(limpio));
    candidatas = candidatas.filter((e) => e.apiRut === buscado || e.apiRut === rutParaApi(RUT_UNICO));
  } else {
    // Una sociedad cuyos proyectos ya tienen mapa no se vuelve a consultar.
    candidatas = candidatas
      .filter((e) => e.proyectos.some((p) => !perfilesExistentes.has(p.id)))
      .sort((a, b) => b.proyectos.length - a.proyectos.length);
  }

  const muestra =
    TOPE_DE_LA_LISTA || RUT_UNICO || candidatas.length <= LIMITE
      ? candidatas.slice(0, LIMITE)
      : Array.from({ length: LIMITE }, (_, i) => candidatas[Math.floor((i * candidatas.length) / LIMITE)]);

  console.log(`Sociedades con proyectos vigentes, RUT válido y sin mapa: ${candidatas.length}`);
  console.log(
    `Procesando ${muestra.length}${TOPE_DE_LA_LISTA || RUT_UNICO ? "" : " (muestreo parejo por tamaño de cartera)"}.`,
  );
  console.log(
    `Corte: se guardan participaciones >= ${UMBRAL_REGISTRO}%; se sube por las >= ${UMBRAL_CONTROL}%, hasta ${NIVELES} nivel${NIVELES === 1 ? "" : "es"}.`,
  );
  console.log(`Nombres ya en la base, reutilizados sin gastar crédito: ${nombresConocidos.size}.\n`);

  let entidades = 0,
    relaciones = 0,
    perfiles = 0,
    sinPct = 0,
    sinDueno = 0,
    truncadas = 0,
    fallidas = 0;

  for (const empresa of muestra) {
    console.log("=".repeat(78));
    const n = empresa.proyectos.length;
    console.log(`${empresa.nombre}   ${empresa.rut}   (${n} proyecto${n === 1 ? "" : "s"} vigente${n === 1 ? "" : "s"})`);

    let cadena: CadenaPropiedad;
    try {
      cadena = await construirCadena(api, empresa.apiRut, { nombresConocidos, nivelMaximo: NIVELES });
    } catch (error) {
      console.log(`   ! ${(error as Error).message}\n`);
      fallidas += 1;
      continue;
    }

    // Lo que esta cadena resolvió sirve para las siguientes de la misma corrida:
    // dos SPV con la misma matriz pagan su nombre una sola vez.
    for (const e of cadena.entidades) {
      if (e.nombre) nombresConocidos.set(e.rutNumerico, e.nombre);
    }

    if (!cadena.relaciones.length) {
      console.log("   sin dueño registrado en la fuente — queda sin mapa societario.\n");
      sinDueno += 1;
      continue;
    }

    const nombreDe = (rutNum: string) => cadena.entidades.find((e) => e.rutNumerico === rutNum)?.nombre ?? rutNum;
    for (const rel of [...cadena.relaciones].sort((a, b) => (b.porcentaje ?? -1) - (a.porcentaje ?? -1))) {
      const pct = rel.porcentaje === null ? "   s/d" : `${rel.porcentaje.toFixed(2).padStart(6)}%`;
      console.log(
        `   ${pct}  ${nombreDe(rel.duenoRut)}  ->  ${nombreDe(rel.poseidoRut)}   [${etiquetaFuente(rel.fuente)}${rel.fechaFuente ? ` ${rel.fechaFuente}` : ""}]`,
      );
    }
    sinPct += cadena.sinPorcentaje;
    if (cadena.truncada) truncadas += 1;

    const fichasNuevas = empresa.proyectos.filter((p) => !perfilesExistentes.has(p.id)).length;

    if (APLICAR) {
      try {
        const escrito = await aplicarCadena(supabase, empresa, cadena, idPorRut, perfilesExistentes);
        entidades += escrito.entidades;
        relaciones += escrito.relaciones;
        perfiles += escrito.perfiles;
        console.log(
          `   escrito: ${escrito.entidades} entidades, ${escrito.relaciones} relaciones, ${escrito.perfiles} fichas   ${cadena.llamadas} créditos\n`,
        );
      } catch (error) {
        console.log(`   ! al escribir: ${(error as Error).message}\n`);
        fallidas += 1;
      }
    } else {
      entidades += cadena.entidades.length;
      relaciones += cadena.relaciones.length;
      perfiles += fichasNuevas;
      console.log(
        `   escribiría: ${cadena.entidades.length} entidades, ${cadena.relaciones.length} relaciones, ${fichasNuevas} fichas   ${cadena.llamadas} créditos\n`,
      );
    }
  }

  const despues = await api.creditos();
  const gastados = despues.consumed_credits - antes.consumed_credits;
  console.log("=".repeat(78));
  console.log(`Entidades${APLICAR ? " creadas" : " que se crearían"}:  ${entidades}`);
  console.log(
    `Relaciones${APLICAR ? " creadas" : " que se crearían"}: ${relaciones}   (${sinPct} sin porcentaje publicado, se guardan igual)`,
  );
  console.log(`Fichas de proyecto${APLICAR ? " asociadas" : " que se asociarían"}: ${perfiles}`);
  console.log(`Sociedades sin dueño en la fuente: ${sinDueno}`);
  console.log(`Cadenas truncadas en el nivel máximo: ${truncadas}`);
  if (fallidas) console.log(`Sociedades con error: ${fallidas}`);
  console.log(`Créditos usados: ${gastados}  (quedan ${despues.request_cap - despues.consumed_credits})`);
  if (muestra.length) {
    const porSociedad = gastados / muestra.length;
    console.log(
      `Promedio por sociedad: ${porSociedad.toFixed(1)}  ->  proyección para ${candidatas.length}: ~${Math.round(porSociedad * candidatas.length)} créditos`,
    );
  }
  if (!APLICAR) console.log("\nNada fue escrito en la base.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
