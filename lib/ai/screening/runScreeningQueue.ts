import type { SupabaseClient } from "@supabase/supabase-js";
import { getProjectById, saveAiScreeningResult } from "@/lib/data-access/projects";
import { searchSeiaByName } from "@/lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "@/lib/ingestion/sources/seia/match";
import { getGlmVerificationSuggestion } from "@/lib/ai/verification/glmSuggestion";
import type { RawSeiaProject } from "@/lib/ingestion/sources/seia/types";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

// Tier gratuito de NVIDIA NIM: ~40 req/min. 1700ms entre proyectos ≈ 35/min.
const DELAY_MS = 1700;
const MAX_SEIA_CANDIDATES = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ScreeningQueueSummary {
  pending: number;
  screened: number;
  sospechosos: number;
  conPick: number;
  errors: number;
}

/**
 * Punto único del tamizado con IA (screening + búsqueda de candidatos SEIA) —
 * usado por scripts/screen-verification-queue.ts (corrida manual) y por
 * app/api/cron/screen-queue/route.ts (cron diario). batchSize se mantiene bajo
 * en el cron para no exceder el límite de duración de las funciones serverless.
 */
export async function runScreeningQueue(client: SupabaseClient | undefined, batchSize: number): Promise<ScreeningQueueSummary> {
  const supabase = client ?? createSupabaseServiceClient();
  const { data: pending, error } = await supabase
    .from("project")
    .select("id")
    .eq("editorial_status", "pending")
    .neq("prefilter_status", "out_of_scope")
    .is("verified_at", null)
    .is("ai_screened_at", null)
    .order("detected_at", { ascending: false })
    .limit(batchSize);
  if (error) throw new Error(error.message);

  const summary: ScreeningQueueSummary = { pending: (pending ?? []).length, screened: 0, sospechosos: 0, conPick: 0, errors: 0 };

  for (const row of pending ?? []) {
    const projectId = row.id as string;
    try {
      const project = await getProjectById(supabase, projectId);
      if (!project) {
        summary.errors++;
      } else {
        const searchTerm = distinctiveTokens(project.name).join(" ");
        const seiaResponse = searchTerm ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES) : { data: [] as RawSeiaProject[] };
        const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

        const { suggestion, error: glmError } = await getGlmVerificationSuggestion(project, candidates);
        if (glmError || !suggestion) {
          summary.errors++;
        } else {
          await saveAiScreeningResult(supabase, projectId, suggestion);
          summary.screened++;
          if (suggestion.dataSanity === "sospechoso") summary.sospechosos++;
          if (suggestion.seiaPick) summary.conPick++;
        }
      }
    } catch {
      summary.errors++;
    } finally {
      await sleep(DELAY_MS);
    }
  }

  return summary;
}
