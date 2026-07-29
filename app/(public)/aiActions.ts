"use server";

import { isAdmin } from "@/lib/auth/session";
import { chatWithKimi, type KimiChatMessage } from "@/lib/ai/provider/kimi";
import { PROJECT_STATS_TOOL, PROJECT_STATS_TOOL_NAME, runProjectStatsQuery } from "@/lib/ai/projectStatsTool";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { clearAiChatMemory, getAiChatMemory, saveAiChatExchange } from "@/lib/data-access/aiChat";

const MONTHLY_LIMIT = 100_000;

export async function askTransitionAi(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  question: string,
): Promise<{ success: true; answer: string; remainingTokens: number | null } | { success: false; error: string }> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion || cleanQuestion.length > 2500) return { success: false, error: "La pregunta es demasiado larga o está vacía." };

  const admin = await isAdmin();
  const profile = await getCurrentUserProfile(await createSupabaseServerClient());
  if (!admin && profile?.planCode !== "premium") return { success: false, error: "Transition AI está disponible en Premium." };

  const service = createSupabaseServiceClient();
  const owner = profile ? { profileId: profile.id } as const : { admin: true } as const;
  const limit = Number(process.env.AI_MONTHLY_TOKEN_LIMIT) || MONTHLY_LIMIT;
  let used = 0;
  if (profile) {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const { data } = await service.from("ai_usage_event").select("input_tokens, output_tokens").eq("user_profile_id", profile.id).gte("created_at", start.toISOString());
    used = (data ?? []).reduce((sum, row) => sum + Number(row.input_tokens) + Number(row.output_tokens), 0);
    if (used >= limit) return { success: false, error: "Alcanzaste la cuota mensual de Transition AI." };
  }

  const storedHistory = await getAiChatMemory(service, owner);
  const effectiveHistory = storedHistory.length > 0 ? storedHistory : history;
  const messages: KimiChatMessage[] = [
    {
      role: "system",
      content:
        "Eres Transition AI, asistente del mercado energético chileno. Responde en el idioma del usuario, de forma breve y útil. No inventes datos ni afirmes haber consultado la plataforma si no recibiste información concreta. " +
        "Formatea siempre la respuesta en párrafos cortos (separados por una línea en blanco) o listas con guiones cuando enumeres varios puntos — nunca un solo bloque de texto corrido. Usa **negrita** solo para 1-2 términos clave por respuesta. " +
        `Cuando la pregunta sea sobre cifras del pipeline de proyectos (cantidad, capacidad MW, horas de almacenamiento BESS, por región o tecnología), usa la herramienta ${PROJECT_STATS_TOOL_NAME} en vez de inventar o negar acceso a los datos.`,
    },
    ...effectiveHistory.slice(-8),
    { role: "user", content: cleanQuestion },
  ];
  try {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let result = await chatWithKimi(messages, { maxTokens: 700, tools: [PROJECT_STATS_TOOL] });
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;

    if (result.toolCalls?.length) {
      messages.push({ role: "assistant", content: result.content, tool_calls: result.toolCalls });
      for (const call of result.toolCalls) {
        let toolContent: string;
        try {
          if (call.function.name !== PROJECT_STATS_TOOL_NAME) throw new Error("Herramienta desconocida");
          const stats = await runProjectStatsQuery(service, call.function.arguments);
          toolContent = JSON.stringify(stats);
        } catch (toolError) {
          toolContent = JSON.stringify({ error: toolError instanceof Error ? toolError.message : "Error al consultar datos" });
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: toolContent });
      }
      result = await chatWithKimi(messages, { maxTokens: 700 });
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
    }

    await saveAiChatExchange(service, owner, cleanQuestion, result.content, result.model);
    if (profile) await service.from("ai_usage_event").insert({ user_profile_id: profile.id, model: result.model, input_tokens: totalInputTokens, output_tokens: totalOutputTokens });
    return { success: true, answer: result.content, remainingTokens: profile ? Math.max(0, limit - used - totalInputTokens - totalOutputTokens) : null };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No pudimos consultar Transition AI." };
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
