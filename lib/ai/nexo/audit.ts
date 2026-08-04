import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NexoIntent, NexoRunOwner } from "./types";

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export async function startNexoRun(
  client: SupabaseClient,
  owner: NexoRunOwner,
  question: string,
  intent: NexoIntent,
): Promise<string | null> {
  const questionHash = createHash("sha256").update(question).digest("hex");
  const { data, error } = await client
    .from("nexo_run")
    .insert({ user_profile_id: owner.profileId, owner_scope: owner.isAdmin && !owner.profileId ? "admin" : "user", intent, question_hash: questionHash })
    .select("id")
    .single();
  if (isMissingTable(error)) return null;
  if (error) throw new Error(`No se pudo iniciar la auditoria de Nexo: ${error.message}`);
  return String(data.id);
}

export async function auditToolCall(
  client: SupabaseClient,
  runId: string | null,
  input: { toolName: string; args: unknown; durationMs: number; rowCount: number | null; status: "completed" | "failed"; error?: string },
): Promise<void> {
  if (!runId) return;
  const argsHash = createHash("sha256").update(JSON.stringify(input.args)).digest("hex");
  const { error } = await client.from("nexo_tool_call").insert({
    run_id: runId,
    tool_name: input.toolName,
    arguments_hash: argsHash,
    duration_ms: input.durationMs,
    row_count: input.rowCount,
    status: input.status,
    error_message: input.error?.slice(0, 500) ?? null,
  });
  if (error && !isMissingTable(error)) throw new Error(`No se pudo auditar la herramienta de Nexo: ${error.message}`);
}

export async function finishNexoRun(
  client: SupabaseClient,
  runId: string | null,
  input: { status: "completed" | "failed"; model?: string; inputTokens?: number; outputTokens?: number; error?: string },
): Promise<void> {
  if (!runId) return;
  const { error } = await client.from("nexo_run").update({
    status: input.status,
    model: input.model ?? null,
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    error_message: input.error?.slice(0, 500) ?? null,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error && !isMissingTable(error)) throw new Error(`No se pudo cerrar la auditoria de Nexo: ${error.message}`);
}
