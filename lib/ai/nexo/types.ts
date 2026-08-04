import type { SupabaseClient } from "@supabase/supabase-js";
import type { KimiTool } from "@/lib/ai/provider/kimi";

export type NexoIntent = "project_lookup" | "company_lookup" | "market_analysis" | "data_quality" | "general";

export interface NexoTool {
  definition: KimiTool;
  intents: NexoIntent[];
  execute: (client: SupabaseClient, args: unknown) => Promise<Record<string, unknown>>;
}

export interface NexoRunOwner {
  profileId: string | null;
  isAdmin: boolean;
}

export interface NexoRunResult {
  answer: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  intent: NexoIntent;
}
