import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStatusMaturity } from "@/lib/shared/projectStatusMaturity";
import {
  constructionTechToCategory,
  operationPlantTypeToCategory,
  pipelineTechCodeToCategory,
  type MarketTechCategory,
} from "@/lib/shared/marketTechCategories";
import { getProjectOwnershipMap } from "@/lib/data-access/projectOwnership";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { buildVigenciaPredicate } from "@/lib/data-access/projects";

/**
 * El grafo de ObsX: todo lo que hoy se puede afirmar alrededor de una empresa.
 *
 * ObsX no inventa una estructura societaria. Conecta las relaciones que SÍ
 * constan en la base, cada una con su fuente y su nivel de certeza:
 *
 *  1. `desarrolla`   empresa → proyecto      project.developer_company_id (dato firme).
 *  2. `opera`        empresa → central       power_plant.owner_name, por coincidencia
 *                                            EXACTA de razón social normalizada (CNE).
 *  3. `construye`    empresa → obra          construction_project.propietario, misma
 *                                            coincidencia exacta (Declaración en
 *                                            Construcción de la CNE).
 *  4. `relacionada`  empresa → empresa       coordinador_empresa.grupo (ADR-019). Es la
 *                                            agrupación del Coordinador, NO propiedad.
 *  5. `razon_social` empresa → razón social  spv.parent_company_id. Son variantes del
 *                                            mismo nombre y cambios de marca, NO
 *                                            filiales (ver ownerPortfolio.ts).
 *  6. `controla`     sociedad → sociedad     ownership_relation, con porcentaje: la
 *                                            única propiedad accionaria real que existe
 *                                            hoy, y solo para los proyectos verificados
 *                                            con ficha societaria cargada.
 *
 * `company_shareholding` sigue vacía: fuera de esas fichas, ObsX no dibuja
 * ninguna flecha de propiedad. Cuando entre la API de sociedades, la relación 6
 * crece y las 4 y 5 dejan de ser el sustituto.
 */

export type ObsxNodeKind =
  | "empresa"
  | "empresa_relacionada"
  | "sociedad"
  | "persona"
  | "proyecto"
  | "activo"
  | "construccion";

export type ObsxLinkKind =
  | "desarrolla"
  | "opera"
  | "construye"
  | "relacionada"
  | "razon_social"
  | "controla"
  | "vehiculo";

/**
 * Tecnología del nodo. Es la taxonomía canónica del sitio más "Transmisión",
 * que tiene color propio en el manual de marca pero todavía no categoría en el
 * pipeline: hoy solo la emite la vista de ejemplo, y la emitirá la
 * infraestructura cuando entre como fuente.
 */
export type ObsxTechCategory = MarketTechCategory | "Transmisión";

export interface ObsxNode {
  id: string;
  label: string;
  kind: ObsxNodeKind;
  /** Categoría canónica de tecnología, para pintar con la paleta de marca. Null en entidades. */
  categoria: ObsxTechCategory | null;
  mw: number | null;
  mwh: number | null;
  region: string | null;
  /** Línea secundaria del nodo: etapa del trámite, estado operativo, RUT. */
  detail: string | null;
  /** Ficha del sitio a la que lleva el nodo, si existe. */
  href: string | null;
  /** De dónde salió este nodo, textual, para el panel lateral. */
  fuente: string;
}

export interface ObsxLink {
  source: string;
  target: string;
  kind: ObsxLinkKind;
  label: string | null;
}

export interface ObsxSummary {
  pipelineMw: number;
  pipelineCount: number;
  operacionMw: number;
  operacionCount: number;
  construccionMw: number;
  construccionCount: number;
  bessMw: number;
  bessMwh: number;
  bessCount: number;
  proximosMw: number;
  proximosCount: number;
  sinTecnologia: number;
  regiones: string[];
  tecnologias: ObsxTechCategory[];
  relacionadas: number;
  razonesSociales: number;
  cadenasSocietarias: number;
}

export interface ObsxGraph {
  company: { id: string; name: string; rut: string | null };
  nodes: ObsxNode[];
  links: ObsxLink[];
  resumen: ObsxSummary;
  /** Lo que quedó fuera del lienzo por el tope de nodos — nunca se recorta en silencio. */
  omitidos: {
    proyectos: number;
    activos: number;
    construccion: number;
    razonesSociales: number;
    relacionadas: number;
  };
}

/** Tope por rama: el lienzo deja de leerse mucho antes de que la consulta se ponga lenta. */
const TOPE = { proyectos: 60, activos: 45, construccion: 25, razonesSociales: 24, relacionadas: 24, cadenas: 4 };

/** Comparación laxa de razones sociales: sin tildes, sin puntuación, sin forma jurídica. */
export function normalizarRazonSocial(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(spa|s a|sa|ltda|limitada|s p a|eirl|inc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palabra distintiva del nombre, para acotar el `ilike` antes de comparar en
 * memoria. Es un prefiltro de la consulta, no el criterio de match: lo que ata
 * una central a una empresa es la igualdad exacta de la razón social normalizada.
 */
function raizDistintiva(nombre: string): string | null {
  const palabras = nombre.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  return palabras.find((p) => p.length >= 5) ?? [...palabras].sort((a, b) => b.length - a.length)[0] ?? null;
}

interface FilaProyecto {
  id: string;
  name: string;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  status: string | null;
  estimated_connection_date: string | null;
  technology: { name: string; code: string | null } | null;
  location: { region: { name: string } | null } | null;
}

function mw(valor: number | null): number {
  return valor ?? 0;
}

export interface ObsxUniverse {
  empresas: number;
  proyectos: number;
  centrales: number;
  obras: number;
  razonesSociales: number;
  gruposCoordinador: number;
  fichasSocietarias: number;
}

/**
 * Los números que encabezan la sección.
 *
 * Se cuenta con `head: true` en vez de traer filas porque PostgREST corta en
 * 1.000 y contar en memoria daría cifras cortadas — el mismo problema que
 * resolvió el RPC del selector de Propietarios.
 */
export async function getObsxUniverse(
  client: SupabaseClient,
  /** `project_ownership_profile` tiene RLS sin políticas: solo se lee con el rol de servicio. */
  serviceClient: SupabaseClient | null,
): Promise<ObsxUniverse> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const contar = async (tabla: string, filtro?: (q: any) => any, lector: SupabaseClient = client): Promise<number> => {
    let q: any = lector.from(tabla).select("*", { count: "exact", head: true });
    if (filtro) q = filtro(q);
    const { count, error } = await q;
    return error ? 0 : (count ?? 0);
  };

  const [empresas, proyectos, centrales, obras, razonesSociales, gruposCoordinador, fichasSocietarias] =
    await Promise.all([
      contar("company"),
      contar("project", (q: any) => q.eq("editorial_status", "published").not("developer_company_id", "is", null)),
      contar("power_plant", (q: any) => q.eq("is_hidden", false)),
      contar("construction_project"),
      contar("spv"),
      contar("coordinador_empresa", (q: any) => q.eq("is_hidden", false).not("grupo", "is", null)),
      serviceClient ? contar("project_ownership_profile", undefined, serviceClient) : Promise.resolve(0),
    ]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return { empresas, proyectos, centrales, obras, razonesSociales, gruposCoordinador, fichasSocietarias };
}

export interface ObsxCompanyOptions {
  /** Empresas cuyos proyectos ya tienen cadena societaria cargada y verificada. */
  conCadenaSocietaria: Array<{ id: string; name: string }>;
  /** Las desarrolladoras con más proyectos publicados, igual que en Propietarios. */
  desarrolladoras: Array<{ id: string; name: string; projectCount: number }>;
}

/**
 * Qué empresas ofrece el selector.
 *
 * Las desarrolladoras grandes solas dejaban fuera lo más distintivo de ObsX: las
 * fichas societarias verificadas cuelgan de sociedades con un solo proyecto, que
 * nunca entran en un ranking por cantidad de proyectos. Van en su propio grupo.
 */
export async function getObsxCompanyOptions(
  client: SupabaseClient,
  serviceClient: SupabaseClient | null,
  desarrolladoras: Array<{ id: string; name: string; projectCount: number }>,
): Promise<ObsxCompanyOptions> {
  if (!serviceClient) return { conCadenaSocietaria: [], desarrolladoras };

  const { data: fichas } = await serviceClient
    .from("project_ownership_profile")
    .select("project:project_id(developer_company_id)")
    .limit(200);

  const ids = [
    ...new Set(
      ((fichas ?? []) as unknown as Array<{ project: { developer_company_id: string | null } | null }>)
        .map((f) => f.project?.developer_company_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (ids.length === 0) return { conCadenaSocietaria: [], desarrolladoras };

  const { data: empresas } = await client.from("company").select("id, name").in("id", ids);
  return {
    conCadenaSocietaria: ((empresas ?? []) as Array<{ id: string; name: string }>).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    ),
    desarrolladoras,
  };
}

/** Tope de proyectos que se dibujan en la vista global antes de que el lienzo deje de leerse. */
const TOPE_GLOBAL_PROYECTOS = 600;

interface FilaProfileProyecto {
  id: string;
  name: string;
  status: string | null;
  estimated_connection_date: string | null;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  technology: { code: string | null } | null;
  location: { region: { name: string } | null } | null;
}

/**
 * La vista consolidada: TODA la red societaria levantada de los proyectos
 * vigentes y su interrelación, en un solo lienzo, sin centrarse en una empresa.
 *
 * A diferencia de `getObsxGraph`, que parte de una empresa y sale hacia afuera,
 * acá se dibujan de una vez todas las entidades (`ownership_entity`), todas las
 * participaciones entre ellas (`ownership_relation`, aristas `controla`) y los
 * proyectos VIGENTES que cada sociedad vehículo sostiene. Como la carga de
 * dequienes se hizo sólo sobre desarrolladoras con proyectos vigentes, este
 * universo ya es el de la cartera vigente; sólo se filtran los proyectos que
 * dejaron de estarlo.
 *
 * Todo vive en tablas cerradas por RLS al usuario final, así que sin
 * `serviceClient` la vista no se puede armar y se devuelve null.
 */
export async function getObsxGlobalGraph(
  client: SupabaseClient,
  serviceClient: SupabaseClient | null,
): Promise<ObsxGraph | null> {
  if (!serviceClient) return null;

  const leerTodo = async <T>(tabla: string, select: string): Promise<T[]> => {
    const filas: T[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await serviceClient.from(tabla).select(select).range(desde, desde + 999);
      if (error) throw new Error(`Error armando la vista global de ObsX (${tabla}): ${error.message}`);
      filas.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return filas;
  };

  const [entidades, relaciones, perfiles, esVigente] = await Promise.all([
    leerTodo<{ id: string; legal_name: string; rut: string | null; entity_type: OwnershipEntityTypeRow }>(
      "ownership_entity",
      "id,legal_name,rut,entity_type",
    ),
    leerTodo<{ owner_entity_id: string; owned_entity_id: string; ownership_percent: number | null }>(
      "ownership_relation",
      "owner_entity_id,owned_entity_id,ownership_percent",
    ),
    leerTodo<{ spv_entity_id: string; project: FilaProfileProyecto | null }>(
      "project_ownership_profile",
      "spv_entity_id,project:project_id(id,name,status,estimated_connection_date,capacity_mw,capacity_mwh,technology:technology_id(code),location:location_id(region:region_id(name)))",
    ),
    buildVigenciaPredicate(client),
  ]);

  const entidadPorId = new Map(entidades.map((e) => [e.id, e]));
  const perfilesVigentes = perfiles.filter((p): p is { spv_entity_id: string; project: FilaProfileProyecto } =>
    p.project !== null && esVigente(p.project),
  );

  const nodes: ObsxNode[] = [];
  const links: ObsxLink[] = [];
  const idsEntidadUsados = new Set<string>();

  // 1 · La interrelación de sociedades: cada participación es una arista.
  for (const rel of relaciones) {
    if (!entidadPorId.has(rel.owner_entity_id) || !entidadPorId.has(rel.owned_entity_id)) continue;
    links.push({
      source: `societaria:${rel.owner_entity_id}`,
      target: `societaria:${rel.owned_entity_id}`,
      kind: "controla",
      label: rel.ownership_percent === null ? null : `${rel.ownership_percent}%`,
    });
    idsEntidadUsados.add(rel.owner_entity_id);
    idsEntidadUsados.add(rel.owned_entity_id);
  }

  // 2 · Los proyectos vigentes que cada sociedad vehículo sostiene. Se dibujan
  // los de mayor potencia primero; si superan el tope, el resto se informa.
  const proyectosOrdenados = [...perfilesVigentes].sort((a, b) => mw(b.project.capacity_mw) - mw(a.project.capacity_mw));
  const proyectosVisibles = proyectosOrdenados.slice(0, TOPE_GLOBAL_PROYECTOS);
  for (const perfil of proyectosVisibles) {
    const p = perfil.project;
    const madurez = getStatusMaturity(p.status);
    nodes.push({
      id: `proyecto:${p.id}`,
      label: p.name,
      kind: "proyecto",
      categoria: pipelineTechCodeToCategory(p.technology?.code ?? null),
      mw: p.capacity_mw,
      mwh: p.capacity_mwh,
      region: p.location?.region?.name ?? null,
      detail: madurez ? `Etapa ${madurez.stage}/${madurez.totalStages}` : (p.status ?? null),
      href: `/proyectos/${p.id}`,
      fuente: "Solicitudes de conexión publicadas (Coordinador Eléctrico Nacional)",
    });
    if (entidadPorId.has(perfil.spv_entity_id)) {
      links.push({ source: `societaria:${perfil.spv_entity_id}`, target: `proyecto:${p.id}`, kind: "vehiculo", label: null });
      idsEntidadUsados.add(perfil.spv_entity_id);
    }
  }

  // 3 · Los nodos de las entidades que quedaron conectadas a algo — sin
  // sociedades sueltas flotando en el lienzo.
  for (const id of idsEntidadUsados) {
    const e = entidadPorId.get(id);
    if (!e) continue;
    nodes.push({
      id: `societaria:${e.id}`,
      label: e.legal_name,
      kind: e.entity_type === "person" ? "persona" : "sociedad",
      categoria: null,
      mw: null,
      mwh: null,
      region: null,
      detail: e.rut ? `RUT ${e.rut}` : e.entity_type === "foreign_company" ? "Sociedad extranjera" : "Sin RUT registrado",
      href: null,
      fuente: "Relaciones societarias de registros públicos (SII, CMF, Diario Oficial)",
    });
  }

  const idsPresentes = new Set(nodes.map((n) => n.id));
  const aristas = links.filter((l) => idsPresentes.has(l.source) && idsPresentes.has(l.target));

  const proyectosVigentes = perfilesVigentes.map((p) => p.project);
  const bess = proyectosVigentes.filter((p) => pipelineTechCodeToCategory(p.technology?.code ?? null) === "BESS");

  return {
    company: { id: "global", name: "Relación global de proyectos y sociedades", rut: null },
    nodes,
    links: aristas,
    resumen: {
      pipelineMw: proyectosVigentes.reduce((suma, p) => suma + mw(p.capacity_mw), 0),
      pipelineCount: proyectosVigentes.length,
      operacionMw: 0,
      operacionCount: 0,
      construccionMw: 0,
      construccionCount: 0,
      bessMw: bess.reduce((suma, p) => suma + mw(p.capacity_mw), 0),
      bessMwh: bess.reduce((suma, p) => suma + mw(p.capacity_mwh), 0),
      bessCount: bess.length,
      proximosMw: 0,
      proximosCount: 0,
      sinTecnologia: 0,
      regiones: [
        ...new Set(proyectosVigentes.map((p) => p.location?.region?.name ?? null).filter((r): r is string => !!r)),
      ].sort((a, b) => a.localeCompare(b, "es")),
      tecnologias: [...new Set(nodes.map((n) => n.categoria).filter((c): c is MarketTechCategory => c !== null))],
      relacionadas: 0,
      razonesSociales: 0,
      cadenasSocietarias: perfilesVigentes.length,
    },
    omitidos: {
      proyectos: Math.max(0, perfilesVigentes.length - TOPE_GLOBAL_PROYECTOS),
      activos: 0,
      construccion: 0,
      razonesSociales: 0,
      relacionadas: 0,
    },
  };
}

/** El `entity_type` tal cual viene de la base, antes de mapearlo a `kind`. */
type OwnershipEntityTypeRow = "company" | "person" | "foreign_company";

/**
 * Todo el entorno de una empresa, listo para dibujar.
 *
 * `serviceClient` se pide aparte porque la cadena societaria vive en tablas
 * cerradas por RLS al usuario final, igual que en la ficha de proyecto. Si no
 * se entrega, el grafo se arma sin esa rama en vez de fallar.
 */
export async function getObsxGraph(
  client: SupabaseClient,
  serviceClient: SupabaseClient | null,
  company: { id: string; name: string; rut: string | null },
): Promise<ObsxGraph> {
  const nombreNormalizado = normalizarRazonSocial(company.name);
  const raiz = raizDistintiva(company.name);

  const [proyectosRes, razonesRes, centralesRes, obrasRes, grupoCoordinador] = await Promise.all([
    client
      .from("project")
      .select(
        "id, name, capacity_mw, capacity_mwh, status, estimated_connection_date, technology:technology_id(name, code), location:location_id(region:region_id(name))",
      )
      .eq("developer_company_id", company.id)
      .eq("editorial_status", "published")
      .order("capacity_mw", { ascending: false, nullsFirst: false })
      .limit(500),
    client.from("spv").select("name").eq("parent_company_id", company.id).order("name").limit(200),
    raiz
      ? client
          .from("power_plant")
          .select("id_central, name, owner_name, net_capacity_mw, status, plant_type, region")
          .eq("is_hidden", false)
          .ilike("owner_name", `%${raiz}%`)
          .limit(400)
      : Promise.resolve({ data: [], error: null }),
    raiz
      ? client
          .from("construction_project")
          .select(
            "id, proyecto_central, propietario, potencia_neta_mw, tipo_tecnologia_final, region, fecha_estimada_interconexion",
          )
          .ilike("propietario", `%${raiz}%`)
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    // Se reutiliza el mismo lector que Propietarios: empata por nombre
    // normalizado contra `coordinador_empresa`, no por el texto crudo.
    getRelatedCompaniesByName(client, company.name),
  ]);

  if (proyectosRes.error) throw new Error(`Error armando el grafo de ObsX: ${proyectosRes.error.message}`);

  const grupo = grupoCoordinador?.grupo ?? null;

  const nodes: ObsxNode[] = [];
  const links: ObsxLink[] = [];
  const raizId = `empresa:${company.id}`;

  nodes.push({
    id: raizId,
    label: company.name,
    kind: "empresa",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: company.rut ? `RUT ${company.rut}` : "Sin RUT registrado",
    href: null,
    fuente: "Registro de empresas de Transition LATAM",
  });

  // 1 · Proyectos futuros en cartera.
  const filasProyecto = (proyectosRes.data ?? []) as unknown as FilaProyecto[];
  const proyectosVisibles = filasProyecto.slice(0, TOPE.proyectos);
  for (const fila of proyectosVisibles) {
    const madurez = getStatusMaturity(fila.status);
    nodes.push({
      id: `proyecto:${fila.id}`,
      label: fila.name,
      kind: "proyecto",
      categoria: pipelineTechCodeToCategory(fila.technology?.code ?? null),
      mw: fila.capacity_mw,
      mwh: fila.capacity_mwh,
      region: fila.location?.region?.name ?? null,
      detail: madurez ? `Etapa ${madurez.stage}/${madurez.totalStages}` : (fila.status ?? null),
      href: `/proyectos/${fila.id}`,
      fuente: "Solicitudes de conexión publicadas (Coordinador Eléctrico Nacional)",
    });
    links.push({ source: raizId, target: `proyecto:${fila.id}`, kind: "desarrolla", label: null });
  }

  // 2 · Centrales en operación. El `ilike` es solo el prefiltro de la consulta;
  // lo que ata la central a la empresa es la igualdad exacta de la razón social
  // normalizada, para no colgarle centrales de un homónimo parcial.
  const centrales = (
    (centralesRes.data ?? []) as Array<{
      id_central: number;
      name: string;
      owner_name: string | null;
      net_capacity_mw: number | null;
      status: string | null;
      plant_type: string | null;
      region: string | null;
    }>
  ).filter((c) => normalizarRazonSocial(c.owner_name ?? "") === nombreNormalizado);
  const centralesOrdenadas = [...centrales].sort((a, b) => mw(b.net_capacity_mw) - mw(a.net_capacity_mw));
  for (const central of centralesOrdenadas.slice(0, TOPE.activos)) {
    nodes.push({
      id: `activo:${central.id_central}`,
      label: central.name,
      kind: "activo",
      categoria: operationPlantTypeToCategory(central.plant_type),
      mw: central.net_capacity_mw,
      mwh: null,
      region: central.region,
      detail: central.status ?? "En operación",
      href: null,
      fuente: "Registro de centrales de la Comisión Nacional de Energía (CNE)",
    });
    links.push({ source: raizId, target: `activo:${central.id_central}`, kind: "opera", label: null });
  }

  // 3 · Obras declaradas en construcción ante la CNE.
  const obras = (
    (obrasRes.data ?? []) as Array<{
      id: string;
      proyecto_central: string;
      propietario: string | null;
      potencia_neta_mw: number | null;
      tipo_tecnologia_final: string | null;
      region: string | null;
      fecha_estimada_interconexion: string | null;
    }>
  ).filter((o) => normalizarRazonSocial(o.propietario ?? "") === nombreNormalizado);
  const obrasOrdenadas = [...obras].sort((a, b) => mw(b.potencia_neta_mw) - mw(a.potencia_neta_mw));
  for (const obra of obrasOrdenadas.slice(0, TOPE.construccion)) {
    nodes.push({
      id: `construccion:${obra.id}`,
      label: obra.proyecto_central,
      kind: "construccion",
      categoria: constructionTechToCategory(obra.tipo_tecnologia_final),
      mw: obra.potencia_neta_mw,
      mwh: null,
      region: obra.region,
      detail: obra.fecha_estimada_interconexion
        ? `Interconexión estimada ${obra.fecha_estimada_interconexion}`
        : "En construcción",
      href: null,
      fuente: "Declaración en Construcción de la Comisión Nacional de Energía (CNE)",
    });
    links.push({ source: raizId, target: `construccion:${obra.id}`, kind: "construye", label: null });
  }

  // 4 · Empresas del mismo grupo del Coordinador. Agrupación, no propiedad.
  const relacionadas = (grupoCoordinador?.relatedNames ?? []).filter(
    (nombre) => normalizarRazonSocial(nombre) !== nombreNormalizado,
  );
  for (const nombre of relacionadas.slice(0, TOPE.relacionadas)) {
    const id = `relacionada:${normalizarRazonSocial(nombre)}`;
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({
      id,
      label: nombre,
      kind: "empresa_relacionada",
      categoria: null,
      mw: null,
      mwh: null,
      region: null,
      detail: `Grupo ${grupo} del Coordinador`,
      href: null,
      fuente: "Registro de empresas coordinadas del Coordinador Eléctrico Nacional",
    });
    links.push({ source: raizId, target: id, kind: "relacionada", label: null });
  }

  // 5 · Otras razones sociales que la fuente vincula a la empresa.
  const razonesSociales = [
    ...new Set(
      ((razonesRes.data ?? []) as Array<{ name: string }>)
        .map((s) => s.name)
        .filter((nombre) => normalizarRazonSocial(nombre) !== nombreNormalizado),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));
  for (const nombre of razonesSociales.slice(0, TOPE.razonesSociales)) {
    const id = `sociedad:${normalizarRazonSocial(nombre)}`;
    if (nodes.some((n) => n.id === id)) continue;
    nodes.push({
      id,
      label: nombre,
      kind: "sociedad",
      categoria: null,
      mw: null,
      mwh: null,
      region: null,
      detail: "Razón social vinculada",
      href: null,
      fuente: "Razones sociales declaradas en las solicitudes de conexión",
    });
    links.push({ source: raizId, target: id, kind: "razon_social", label: null });
  }

  // 6 · Cadena societaria verificada: la única propiedad que ObsX afirma.
  let cadenasSocietarias = 0;
  if (serviceClient && proyectosVisibles.length > 0) {
    const { data: fichas } = await serviceClient
      .from("project_ownership_profile")
      .select("project_id")
      .in(
        "project_id",
        proyectosVisibles.map((p) => p.id),
      )
      .limit(TOPE.cadenas);

    for (const ficha of (fichas ?? []) as Array<{ project_id: string }>) {
      const mapa = await getProjectOwnershipMap(serviceClient, ficha.project_id);
      if (!mapa) continue;
      cadenasSocietarias += 1;
      for (const entidad of mapa.entities) {
        const id = `societaria:${entidad.id}`;
        if (nodes.some((n) => n.id === id)) continue;
        nodes.push({
          id,
          label: entidad.legalName,
          kind: entidad.entityType === "person" ? "persona" : "sociedad",
          categoria: null,
          mw: null,
          mwh: null,
          region: null,
          detail: entidad.rut
            ? `RUT ${entidad.rut}`
            : entidad.entityType === "foreign_company"
              ? "Sociedad extranjera"
              : "Sin RUT registrado",
          href: null,
          fuente: "Información societaria verificada de la ficha del proyecto",
        });
      }
      for (const relacion of mapa.relations) {
        links.push({
          source: `societaria:${relacion.ownerEntityId}`,
          target: `societaria:${relacion.ownedEntityId}`,
          kind: "controla",
          label: relacion.ownershipPercent === null ? null : `${relacion.ownershipPercent}%`,
        });
      }
      // La sociedad vehículo es la que sostiene el proyecto: ese es el puente
      // entre la cadena societaria y el activo dibujado en el lienzo.
      links.push({
        source: `societaria:${mapa.spvEntityId}`,
        target: `proyecto:${ficha.project_id}`,
        kind: "vehiculo",
        label: null,
      });
    }
  }

  // Una arista societaria puede apuntar a un nodo que quedó fuera del tope.
  const idsPresentes = new Set(nodes.map((n) => n.id));
  const aristas = links.filter((l) => idsPresentes.has(l.source) && idsPresentes.has(l.target));

  const hoy = new Date();
  const hoyIso = hoy.toISOString().slice(0, 10);
  const horizonte = new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10);
  const proximos = filasProyecto.filter(
    (p) =>
      p.estimated_connection_date !== null &&
      p.estimated_connection_date >= hoyIso &&
      p.estimated_connection_date <= horizonte,
  );
  const bess = filasProyecto.filter((p) => pipelineTechCodeToCategory(p.technology?.code ?? null) === "BESS");

  return {
    company,
    nodes,
    links: aristas,
    resumen: {
      pipelineMw: filasProyecto.reduce((suma, p) => suma + mw(p.capacity_mw), 0),
      pipelineCount: filasProyecto.length,
      operacionMw: centrales.reduce((suma, c) => suma + mw(c.net_capacity_mw), 0),
      operacionCount: centrales.length,
      construccionMw: obras.reduce((suma, o) => suma + mw(o.potencia_neta_mw), 0),
      construccionCount: obras.length,
      bessMw: bess.reduce((suma, p) => suma + mw(p.capacity_mw), 0),
      bessMwh: bess.reduce((suma, p) => suma + mw(p.capacity_mwh), 0),
      bessCount: bess.length,
      proximosMw: proximos.reduce((suma, p) => suma + mw(p.capacity_mw), 0),
      proximosCount: proximos.length,
      sinTecnologia: filasProyecto.filter((p) => pipelineTechCodeToCategory(p.technology?.code ?? null) === null).length,
      regiones: [
        ...new Set(
          [
            ...filasProyecto.map((p) => p.location?.region?.name ?? null),
            ...centrales.map((c) => c.region),
            ...obras.map((o) => o.region),
          ].filter((r): r is string => !!r),
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
      tecnologias: [...new Set(nodes.map((n) => n.categoria).filter((c): c is MarketTechCategory => c !== null))],
      relacionadas: relacionadas.length,
      razonesSociales: razonesSociales.length,
      cadenasSocietarias,
    },
    omitidos: {
      proyectos: Math.max(0, filasProyecto.length - TOPE.proyectos),
      activos: Math.max(0, centrales.length - TOPE.activos),
      construccion: Math.max(0, obras.length - TOPE.construccion),
      razonesSociales: Math.max(0, razonesSociales.length - TOPE.razonesSociales),
      relacionadas: Math.max(0, relacionadas.length - TOPE.relacionadas),
    },
  };
}
