import type { SupabaseClient } from "@supabase/supabase-js";

export interface AiQuotaPeriod {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface AiQuotaSnapshot {
  daily: AiQuotaPeriod;
  weekly: AiQuotaPeriod;
  monthly: AiQuotaPeriod;
}

const DEFAULT_DAILY_LIMIT = 15_000;
const DEFAULT_WEEKLY_LIMIT = 50_000;
const DEFAULT_MONTHLY_LIMIT = 120_000;
export const AI_REQUEST_RESERVE = 1_000;

function positiveLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcWeek(now: Date): Date {
  const start = startOfUtcDay(now);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function nextDay(start: Date): Date {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function nextWeek(start: Date): Date {
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + 7);
  return date;
}

function nextMonth(start: Date): Date {
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

function period(used: number, limit: number, resetsAt: Date): AiQuotaPeriod {
  return { used, limit, remaining: Math.max(0, limit - used), resetsAt: resetsAt.toISOString() };
}

export async function getAiUsageQuota(
  client: SupabaseClient,
  userProfileId: string,
  now = new Date(),
): Promise<AiQuotaSnapshot> {
  const dayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);
  const monthStart = startOfUtcMonth(now);
  const earliest = new Date(Math.min(dayStart.getTime(), weekStart.getTime(), monthStart.getTime()));
  const { data, error } = await client
    .from("ai_usage_event")
    .select("input_tokens, output_tokens, created_at")
    .eq("user_profile_id", userProfileId)
    .gte("created_at", earliest.toISOString());
  if (error) throw new Error(`Error consultando el consumo de Nexo: ${error.message}`);

  let dailyUsed = 0;
  let weeklyUsed = 0;
  let monthlyUsed = 0;
  for (const row of data ?? []) {
    const createdAt = new Date(String(row.created_at)).getTime();
    const tokens = Number(row.input_tokens) + Number(row.output_tokens);
    if (createdAt >= monthStart.getTime()) monthlyUsed += tokens;
    if (createdAt >= weekStart.getTime()) weeklyUsed += tokens;
    if (createdAt >= dayStart.getTime()) dailyUsed += tokens;
  }

  return {
    daily: period(dailyUsed, positiveLimit(process.env.AI_DAILY_TOKEN_LIMIT, DEFAULT_DAILY_LIMIT), nextDay(dayStart)),
    weekly: period(weeklyUsed, positiveLimit(process.env.AI_WEEKLY_TOKEN_LIMIT, DEFAULT_WEEKLY_LIMIT), nextWeek(weekStart)),
    monthly: period(monthlyUsed, positiveLimit(process.env.AI_MONTHLY_TOKEN_LIMIT, DEFAULT_MONTHLY_LIMIT), nextMonth(monthStart)),
  };
}

export function getBlockingQuotaPeriod(quota: AiQuotaSnapshot, reserve = AI_REQUEST_RESERVE): keyof AiQuotaSnapshot | null {
  if (quota.daily.remaining < reserve) return "daily";
  if (quota.weekly.remaining < reserve) return "weekly";
  if (quota.monthly.remaining < reserve) return "monthly";
  return null;
}
