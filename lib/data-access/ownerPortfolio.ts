import type { SupabaseClient } from "@supabase/supabase-js";
import { getStatusMaturity } from "@/lib/shared/projectStatusMaturity";

/**
 * La cartera de una empresa: sus proyectos, su potencia y sus sociedades.
 *
 * Lo que hay hoy y lo que no, medido el 2026-08-17:
 *
 * - SÍ: 631 empresas con proyectos, 2.096 proyectos con desarrollador, 1.162
 *   personas vinculadas y 1.616 SPV que declaran una matriz.
 * - NO: `company_shareholding` está VACÍA — no hay una sola participación
 *   accionaria registrada. Por eso acá no se arma una red societaria: lo único
 *   que la fuente sostiene es un nivel, matriz → sus SPV. Afirmar más sería
 *   inventar la estructura de propiedad de una empresa real.
 *
 * Cuando se integre la API de sociedades, este módulo es el que crece.
 */

export interface OwnerOverviewStats {
  empresasConProyectos: number;
  proyectos: number;
  contactos: number;
  spvConMatriz: number;
}

export async function getOwnerOverviewStats(client: SupabaseClient): Promise<OwnerOverviewStats> {
  // Todos los conteos se acotan a lo publicado, igual que la RPC: un total que
  // no cuadra con la lista que lo acompaña se lee como error aunque cada número
  // sea correcto por separado.
  const [empresas, proyectos, contactos, spvs] = await Promise.all([
    client.rpc("count_companies_with_projects"),
    client
      .from("project")
      .select("id", { count: "exact", head: true })
      .not("developer_company_id", "is", null)
      .eq("editorial_status", "published"),
    client.from("person").select("id", { count: "exact", head: true }),
    client.from("spv").select("id", { count: "exact", head: true }).not("parent_company_id", "is", null),
  ]);
  return {
    empresasConProyectos: Number(empresas.data ?? 0),
    proyectos: proyectos.count ?? 0,
    contactos: contactos.count ?? 0,
    spvConMatriz: spvs.count ?? 0,
  };
}

/**
 * Empresas cuyo nombre se parece al dado: probables duplicados que no se
 * pudieron consolidar.
 *
 * La fusión del 2026-08-16 unió las que compartían RUT. Las que no tienen RUT
 * quedaron sueltas: "Grenergy" aparece hoy en 8 filas, de las cuales solo 2
 * tienen proyectos, y en la ficha se leen como empresas distintas.
 *
 * Devuelve nombres para avisar, NO para fusionar. Sin RUT no se puede afirmar
 * que dos nombres parecidos sean la misma persona jurídica — "Solar Elena SpA -
 * Grenergy Renovables Pacific Limitada" contiene el nombre pero podría ser un
 * vehículo conjunto con otro dueño. Atar empresas equivocadas cuesta más que
 * mostrarlas separadas con una advertencia.
 */
export async function getSimilarCompanyNames(
  client: SupabaseClient,
  companyId: string,
  companyName: string,
): Promise<string[]> {
  // Se busca por la primera palabra distintiva: es lo que comparten las
  // variantes ("Grenergy Renovables Pacific Ltda." y "GRENERGY PACIFIC
  // LIMITADA") sin arrastrar a cualquiera que diga "Energía" o "SpA".
  const raiz = companyName
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((palabra) => palabra.length >= 5)[0];
  if (!raiz) return [];

  const { data, error } = await client
    .from("company")
    .select("id, name")
    .ilike("name", `%${raiz}%`)
    .neq("id", companyId)
    .limit(20);
  if (error) return [];
  return ((data ?? []) as Array<{ name: string }>).map((c) => c.name);
}

export interface OwnerProject {
  id: string;
  name: string;
  technology: string | null;
  capacityMw: number | null;
  capacityMwh: number | null;
  region: string | null;
  status: string | null;
  /** Etapa del trámite sobre el total, la misma que muestra la tabla de proyectos. */
  etapa: string | null;
  estimatedConnectionDate: string | null;
}

export interface OwnerPortfolio {
  proyectos: OwnerProject[];
  totalMw: number;
  tecnologias: string[];
  regiones: string[];
  spvs: string[];
}

interface FilaProyecto {
  id: string;
  name: string;
  capacity_mw: number | null;
  capacity_mwh: number | null;
  status: string | null;
  estimated_connection_date: string | null;
  technology: { name: string } | null;
  location: { region: { name: string } | null } | null;
}

/**
 * Todo lo que se puede decir de una empresa con la data actual.
 *
 * Se piden solo los proyectos publicados: son los que el cliente puede abrir
 * desde la tabla, y contar en el resumen unos que no puede ver haría que los
 * números no cuadren con la lista de abajo.
 */
export async function getOwnerPortfolio(client: SupabaseClient, companyId: string): Promise<OwnerPortfolio> {
  const [proyectosRes, spvsRes] = await Promise.all([
    client
      .from("project")
      .select(
        "id, name, capacity_mw, capacity_mwh, status, estimated_connection_date, technology:technology_id(name), location:location_id(region:region_id(name))",
      )
      .eq("developer_company_id", companyId)
      .eq("editorial_status", "published")
      .order("capacity_mw", { ascending: false, nullsFirst: false })
      .limit(500),
    client.from("spv").select("name").eq("parent_company_id", companyId).order("name").limit(200),
  ]);
  if (proyectosRes.error) throw new Error(`Error obteniendo la cartera: ${proyectosRes.error.message}`);

  const filas = (proyectosRes.data ?? []) as unknown as FilaProyecto[];
  const proyectos: OwnerProject[] = filas.map((f) => {
    const madurez = getStatusMaturity(f.status);
    return {
      id: f.id,
      name: f.name,
      technology: f.technology?.name ?? null,
      capacityMw: f.capacity_mw,
      capacityMwh: f.capacity_mwh,
      region: f.location?.region?.name ?? null,
      status: f.status,
      etapa: madurez ? `${madurez.stage}/${madurez.totalStages}` : null,
      estimatedConnectionDate: f.estimated_connection_date,
    };
  });

  return {
    proyectos,
    totalMw: proyectos.reduce((suma, p) => suma + (p.capacityMw ?? 0), 0),
    tecnologias: [...new Set(proyectos.map((p) => p.technology).filter((t): t is string => !!t))].sort(),
    regiones: [...new Set(proyectos.map((p) => p.region).filter((r): r is string => !!r))].sort(),
    spvs: ((spvsRes.data ?? []) as Array<{ name: string }>).map((s) => s.name),
  };
}
