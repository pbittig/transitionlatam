import type { SupabaseClient } from "@supabase/supabase-js";
import { getStatusMaturity } from "@/lib/shared/projectStatusMaturity";
import { pipelineTechCodeToCategory, type MarketTechCategory } from "@/lib/shared/marketTechCategories";

/**
 * La cartera de una empresa: sus proyectos, su potencia y sus sociedades.
 *
 * Lo que hay hoy y lo que no, medido el 2026-08-17:
 *
 * - SÍ: 373 empresas con proyectos publicados y 2.022 proyectos con
 *   desarrollador. La cartera es dato firme.
 * - NO: propiedad. `company_shareholding` está VACÍA —cero participaciones
 *   accionarias— y `spv.parent_company_id` NO es una relación matriz→filial
 *   aunque lo parezca: de sus 1.616 filas, 1.509 llevan exactamente el mismo
 *   nombre que su "matriz", 81 son variantes con erratas, y casi todo el resto
 *   son cambios de marca de la misma empresa (Solarpack→Zelestra, AES
 *   Gener→AES Andes) o relaciones invertidas. Es una tabla de variantes de
 *   razón social, no un organigrama, y por eso acá no se deriva estructura de
 *   propiedad de ella.
 *
 * Cuando se integre la API de sociedades, este módulo es el que crece.
 */

/** Comparación laxa de razones sociales: sin tildes, sin puntuación, sin mayúsculas. */
function mismaRazonSocial(a: string, b: string): boolean {
  const limpiar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // marcas diacríticas combinantes
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return limpiar(a) === limpiar(b);
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
  /** Categoría canónica, para pintar con la paleta de marca en vez de por nombre libre. */
  categoria: MarketTechCategory | null;
  capacityMw: number | null;
  capacityMwh: number | null;
  region: string | null;
  status: string | null;
  /** Etapa del trámite sobre el total, la misma que muestra la tabla de proyectos. */
  etapa: string | null;
  estimatedConnectionDate: string | null;
  /** Revisado a mano por el equipo editorial. Es el único subconjunto que la tabla de Proyectos Futuros lista. */
  verificado: boolean;
}

export interface OwnerPortfolio {
  proyectos: OwnerProject[];
  totalMw: number;
  /** Cuántos de esos proyectos ya pasaron por revisión editorial. */
  verificados: number;
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
  verified_at: string | null;
  technology: { name: string; code: string | null } | null;
  location: { region: { name: string } | null } | null;
}

/**
 * Todo lo que se puede decir de una empresa con la data actual.
 *
 * Se piden solo los proyectos publicados: son los que el cliente puede abrir
 * desde la tabla, y contar en el resumen unos que no puede ver haría que los
 * números no cuadren con la lista de abajo.
 */
export async function getOwnerPortfolio(
  client: SupabaseClient,
  companyId: string,
  companyName: string,
): Promise<OwnerPortfolio> {
  const [proyectosRes, spvsRes] = await Promise.all([
    client
      .from("project")
      .select(
        "id, name, capacity_mw, capacity_mwh, status, estimated_connection_date, verified_at, technology:technology_id(name, code), location:location_id(region:region_id(name))",
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
      categoria: pipelineTechCodeToCategory(f.technology?.code ?? null),
      capacityMw: f.capacity_mw,
      capacityMwh: f.capacity_mwh,
      region: f.location?.region?.name ?? null,
      status: f.status,
      etapa: madurez ? `${madurez.stage}/${madurez.totalStages}` : null,
      estimatedConnectionDate: f.estimated_connection_date,
      verificado: f.verified_at !== null,
    };
  });

  return {
    proyectos,
    totalMw: proyectos.reduce((suma, p) => suma + (p.capacityMw ?? 0), 0),
    verificados: proyectos.filter((p) => p.verificado).length,
    tecnologias: [...new Set(proyectos.map((p) => p.technology).filter((t): t is string => !!t))].sort(),
    regiones: [...new Set(proyectos.map((p) => p.region).filter((r): r is string => !!r))].sort(),
    // Se descartan las que repiten la razón social de la propia empresa y se
    // deduplican las repetidas: sin esto, Sphera muestra 30 "sociedades
    // vehículo" todas llamadas "SPHERA DEVELOPMENT SPA", que se lee como un
    // error de la pantalla y no como información.
    spvs: [
      ...new Set(
        ((spvsRes.data ?? []) as Array<{ name: string }>)
          .map((s) => s.name)
          .filter((nombre) => !mismaRazonSocial(nombre, companyName)),
      ),
    ].sort((a, b) => a.localeCompare(b, "es")),
  };
}
