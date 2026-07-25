import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";

export interface RelatedCompanyGroup {
  grupo: number;
  relatedNames: string[];
}

/**
 * Empresas relacionadas por el `grupo` oficial del Coordinador Eléctrico Nacional
 * (ver ADR-019) — vínculo best-effort por nombre normalizado, no por RUT (no
 * disponible en esta fuente). Devuelve null si la empresa no aparece en el
 * registro o no tiene otras empresas en su mismo grupo.
 */
export async function getRelatedCompaniesByName(
  client: SupabaseClient,
  companyName: string | null,
): Promise<RelatedCompanyGroup | null> {
  if (!companyName) return null;
  const nameNormalized = normalizeForMatch(companyName);

  const { data: self } = await client
    .from("coordinador_empresa")
    .select("grupo")
    .eq("name_normalized", nameNormalized)
    .eq("is_hidden", false)
    .not("grupo", "is", null)
    .maybeSingle();

  if (!self || self.grupo === null) return null;

  const { data: siblings } = await client
    .from("coordinador_empresa")
    .select("nombre")
    .eq("grupo", self.grupo)
    .eq("is_hidden", false)
    .neq("name_normalized", nameNormalized);

  const relatedNames = (siblings ?? []).map((s) => s.nombre as string);
  if (relatedNames.length === 0) return null;

  return { grupo: self.grupo, relatedNames };
}
