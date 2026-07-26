"use server";

import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getProjectById, saveAiScreeningResult } from "@/lib/data-access/projects";
import { searchSeiaByName } from "@/lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "@/lib/ingestion/sources/seia/match";
import { getGlmVerificationSuggestion, type VerificationSuggestion } from "@/lib/ai/verification/glmSuggestion";
import type { RawSeiaProject } from "@/lib/ingestion/sources/seia/types";

const MAX_SEIA_CANDIDATES = 10;

export interface AiSuggestionResult {
  success: boolean;
  suggestion?: VerificationSuggestion;
  candidates?: RawSeiaProject[];
  error?: string;
}

/**
 * Sugerencia bajo demanda (no automática) — el admin la pide con un botón.
 * Nunca escribe nada: solo devuelve el veredicto de GLM más los candidatos
 * SEIA reales (para que el botón "Usar este candidato" en la UI pueda pasarle
 * el RawSeiaProject completo a assignSeiaMatch sin una segunda consulta).
 */
export async function getAiVerificationSuggestion(projectId: string): Promise<AiSuggestionResult> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }

  try {
    const client = createSupabaseServiceClient();
    const project = await getProjectById(client, projectId);
    if (!project) {
      return { success: false, error: "Proyecto no encontrado." };
    }

    // Mismas palabras distintivas que usa findBestSeiaMatch — ver
    // lib/ingestion/sources/seia/match.ts. Así GLM ve el mismo universo de
    // candidatos que el matching determinístico, no una búsqueda distinta.
    const searchTerm = distinctiveTokens(project.name).join(" ");
    const seiaResponse = searchTerm ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES) : { data: [] as RawSeiaProject[] };
    const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

    const { suggestion, error } = await getGlmVerificationSuggestion(project, candidates);
    if (error || !suggestion) {
      return { success: false, error: error ?? "GLM no devolvió una sugerencia." };
    }

    // Persistence is a non-fatal side-effect: the GLM suggestion above already
    // succeeded, so a database failure here must never propagate and undo/mask that
    // success — warn and return the valid suggestion anyway.
    try {
      await saveAiScreeningResult(client, projectId, suggestion);
    } catch (err) {
      console.warn(
        `[AI Screening] Warning: Could not persist AI screening result for project ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return { success: true, suggestion, candidates };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
