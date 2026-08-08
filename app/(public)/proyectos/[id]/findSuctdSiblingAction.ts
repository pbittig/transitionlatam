"use server";

import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { fetchSolicitudesFromApi, normalizeApiRow } from "@/lib/ingestion/sources/energia-abierta/listado/fetchFromApi";
import { normalizeForMatch } from "@/lib/ingestion/sources/energia-abierta/listado/normalize";
import { statusRank } from "@/lib/ingestion/sources/energia-abierta/listado/load";

export interface SuctdSiblingResult {
  externalId: string;
  projectName: string;
  statusLabel: string;
  requestType: string | null;
  estimatedConnectionDate: string | null;
}

/**
 * Búsqueda en vivo (admin, on-demand) de una solicitud hermana más avanzada
 * para el mismo proyecto físico — misma regla de nombre normalizado que usa
 * la promoción automática del sync (ver statusRank en load.ts). Si esto
 * encuentra algo, significa que el sync todavía no la ha promovido sobre este
 * registro (corrida pendiente o problema de matching), no que el dato no
 * exista en Acceso Abierto.
 */
export async function findSuctdSibling(projectId: string): Promise<SuctdSiblingResult | null> {
  if (!(await isAdmin())) throw new Error("No autorizado.");

  const client = createSupabaseServiceClient();
  const { data: project, error } = await client
    .from("project")
    .select("name, external_reference")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(`Error obteniendo proyecto: ${error.message}`);
  if (!project) throw new Error("Proyecto no encontrado.");

  const normalizedTarget = normalizeForMatch(project.name as string);
  const currentExternalReference = project.external_reference as string | null;

  const rawRows = await fetchSolicitudesFromApi();
  let best: SuctdSiblingResult | null = null;
  let bestRank = -1;

  for (const raw of rawRows) {
    const externalId = String(raw.id);
    if (externalId === currentExternalReference) continue;
    if (normalizeForMatch(raw.proyecto ?? "") !== normalizedTarget) continue;

    const normalized = normalizeApiRow(raw);
    const rank = statusRank(normalized.statusLabel);
    if (rank > bestRank) {
      bestRank = rank;
      best = {
        externalId,
        projectName: normalized.projectName,
        statusLabel: normalized.statusLabel,
        requestType: normalized.requestType,
        estimatedConnectionDate: normalized.estimatedConnectionDate,
      };
    }
  }

  return best;
}
