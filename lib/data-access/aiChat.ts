import type { SupabaseClient } from "@supabase/supabase-js";

export interface AiChatMemoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function getAiChatMemory(
  client: SupabaseClient,
  owner: { profileId: string } | { admin: true },
  limit = 16,
): Promise<AiChatMemoryMessage[]> {
  let query = client
    .from("ai_chat_message")
    .select("role, content, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  query = "profileId" in owner
    ? query.eq("owner_scope", "user").eq("user_profile_id", owner.profileId)
    : query.eq("owner_scope", "admin").is("user_profile_id", null);

  const { data, error } = await query;
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error(`Error obteniendo memoria de IA: ${error.message}`);
  return (data ?? [])
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content as string }));
}

export async function saveAiChatExchange(
  client: SupabaseClient,
  owner: { profileId: string } | { admin: true },
  question: string,
  answer: string,
  model: string,
): Promise<void> {
  const ownerFields = "profileId" in owner
    ? { owner_scope: "user", user_profile_id: owner.profileId }
    : { owner_scope: "admin", user_profile_id: null };
  const { error } = await client.from("ai_chat_message").insert([
    { ...ownerFields, role: "user", content: question },
    { ...ownerFields, role: "assistant", content: answer, model },
  ]);
  if (error) throw new Error(`Error guardando memoria de IA: ${error.message}`);
}

export async function clearAiChatMemory(
  client: SupabaseClient,
  owner: { profileId: string } | { admin: true },
): Promise<void> {
  let query = client.from("ai_chat_message").delete();
  query = "profileId" in owner
    ? query.eq("owner_scope", "user").eq("user_profile_id", owner.profileId)
    : query.eq("owner_scope", "admin").is("user_profile_id", null);
  const { error } = await query;
  if (error) throw new Error(`Error borrando memoria de IA: ${error.message}`);
}
