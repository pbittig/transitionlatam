import type { SupabaseClient } from "@supabase/supabase-js";

export interface CompanyOption {
  id: string;
  name: string;
  projectCount: number;
}

/** Empresas desarrolladoras con más proyectos en el pipeline — para el selector del Mapa Stakeholder. */
export async function getTopCompaniesByProjectCount(client: SupabaseClient, limit = 40): Promise<CompanyOption[]> {
  const { data, error } = await client.from("project").select("developer_company_id").not("developer_company_id", "is", null);
  if (error) throw new Error(`Error leyendo empresas desarrolladoras: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.developer_company_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (topIds.length === 0) return [];

  const { data: companies, error: companyError } = await client
    .from("company")
    .select("id, name")
    .in("id", topIds.map(([id]) => id));
  if (companyError) throw new Error(`Error leyendo empresas: ${companyError.message}`);

  const nameById = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  return topIds
    .filter(([id]) => nameById.has(id))
    .map(([id, count]) => ({ id, name: nameById.get(id)!, projectCount: count }));
}

export async function getCompanyById(client: SupabaseClient, id: string): Promise<{ id: string; name: string; rut: string | null } | null> {
  const { data, error } = await client.from("company").select("id, name, rut").eq("id", id).maybeSingle();
  if (error) throw new Error(`Error leyendo empresa: ${error.message}`);
  return data as { id: string; name: string; rut: string | null } | null;
}

export interface CompanyShareholder {
  role: string;
  ownershipPct: number | null;
  confidenceLevel: string;
  company: { id: string; name: string; rut: string | null } | null;
  person: { id: string; name: string } | null;
}

export async function getCompanyShareholders(client: SupabaseClient, companyId: string): Promise<CompanyShareholder[]> {
  const { data, error } = await client
    .from("company_shareholding")
    .select("relationship_role, ownership_pct, confidence_level, shareholder_company:shareholder_company_id(id, name, rut), shareholder_person:shareholder_person_id(id, full_name)")
    .eq("company_id", companyId)
    .is("valid_to", null);
  // La UI puede desplegarse antes que la migración societaria. En ese lapso la
  // tabla aún no existe en el schema cache de PostgREST: se trata como una
  // relación todavía no cargada, no como un error de la página.
  if (error?.code === "PGRST205") return [];
  if (error) throw new Error(`Error leyendo participaciones societarias: ${error.message}`);

  return ((data ?? []) as unknown as Array<{
    relationship_role: string; ownership_pct: number | null; confidence_level: string;
    shareholder_company: { id: string; name: string; rut: string | null } | null;
    shareholder_person: { id: string; full_name: string } | null;
  }>).map((item) => ({
    role: item.relationship_role,
    ownershipPct: item.ownership_pct,
    confidenceLevel: item.confidence_level,
    company: item.shareholder_company,
    person: item.shareholder_person ? { id: item.shareholder_person.id, name: item.shareholder_person.full_name } : null,
  }));
}
