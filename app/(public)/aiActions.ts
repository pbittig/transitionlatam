"use server";

import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { clearAiChatMemory, getAiChatMemory, saveAiChatExchange } from "@/lib/data-access/aiChat";
import { getAiUsageQuota, getBlockingQuotaPeriod, type AiQuotaSnapshot } from "@/lib/ai/usageQuota";
import { runNexoOrchestrator } from "@/lib/ai/nexo/orchestrator";

export async function askTransitionAi(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  question: string,
  onDelta?: (content: string) => void,
): Promise<{ success: true; answer: string; quota: AiQuotaSnapshot | null } | { success: false; error: string; quota?: AiQuotaSnapshot }> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || cleanQuestion.length > 2500) return { success: false, error: "La pregunta es demasiado larga o esta vacia." };

  const admin = await isAdmin();
  const profile = await getCurrentUserProfile(await createSupabaseServerClient());
  if (!admin && profile?.planCode !== "premium") return { success: false, error: "Nexo esta disponible en Premium." };

  const service = createSupabaseServiceClient();
  const owner = profile ? { profileId: profile.id } as const : { admin: true } as const;
  const language = profile?.preferredLanguage === "en" ? "en" : "es";
  let quota: AiQuotaSnapshot | null = null;
  if (profile) {
    quota = await getAiUsageQuota(service, profile.id);
    const blockedBy = getBlockingQuotaPeriod(quota);
    if (blockedBy) {
      const labels = language === "en"
        ? { daily: "daily", weekly: "weekly", monthly: "monthly" }
        : { daily: "diaria", weekly: "semanal", monthly: "mensual" };
      return {
        success: false,
        error: language === "en"
          ? `You have reached Nexo's ${labels[blockedBy]} allowance. It will reset automatically.`
          : `Ha alcanzado la cuota ${labels[blockedBy]} de Nexo. Se restablecera automaticamente.`,
        quota,
      };
    }
  }

  const storedHistory = await getAiChatMemory(service, owner);
  const effectiveHistory = storedHistory.length > 0 ? storedHistory : history;
  try {
    const result = await runNexoOrchestrator({
      client: service,
      owner: { profileId: profile?.id ?? null, isAdmin: admin },
      question: cleanQuestion,
      history: effectiveHistory,
      language,
      onDelta,
    });

    await saveAiChatExchange(service, owner, cleanQuestion, result.answer, result.model);
    if (profile) {
      const { error: usageError } = await service.from("ai_usage_event").insert({
        user_profile_id: profile.id,
        model: result.model,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
      });
      if (usageError) throw new Error(`No se pudo registrar el consumo de Nexo: ${usageError.message}`);
      quota = await getAiUsageQuota(service, profile.id);
    }
    return { success: true, answer: result.answer, quota };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No pudimos consultar a Nexo." };
  }
}

export async function clearTransitionAiHistory(): Promise<{ success: boolean }> {
  const admin = await isAdmin();
  const profile = await getCurrentUserProfile(await createSupabaseServerClient());
  if (!admin && profile?.planCode !== "premium") return { success: false };
  const owner = profile ? { profileId: profile.id } as const : { admin: true } as const;
  await clearAiChatMemory(createSupabaseServiceClient(), owner);
  return { success: true };
}
