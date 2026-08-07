import type { SupabaseClient } from "@supabase/supabase-js";

/** Below this many observations, a stat is not trusted — fall back instead of shipping noise. */
const MIN_CALIBRATION_SAMPLE_SIZE = 5;

export interface ScheduleCalibration {
  codSlippageDaysAvg: number;
  sampleSize: number;
  scope: "developer" | "sector";
}

async function getSectorCalibration(client: SupabaseClient): Promise<ScheduleCalibration | null> {
  const { data, error } = await client
    .from("schedule_calibration_stat")
    .select("cod_slippage_days_avg, cod_slippage_sample_size")
    .is("developer_company_id", null)
    .maybeSingle();
  // Allows application deployment before the additive migration is applied.
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw new Error(`Error obteniendo calibración sectorial de cronograma: ${error.message}`);
  const sampleSize = (data?.cod_slippage_sample_size as number | null) ?? 0;
  if (!data || sampleSize < MIN_CALIBRATION_SAMPLE_SIZE || data.cod_slippage_days_avg === null) return null;
  return { codSlippageDaysAvg: Number(data.cod_slippage_days_avg), sampleSize, scope: "sector" };
}

/**
 * Developer-specific calibration when there's enough history to trust it,
 * falling back to the sector-wide figure, falling back to null (no
 * adjustment — today's behavior) when neither has enough samples yet. See
 * lib/analytics/scheduleCalibration.ts for how these numbers are computed.
 */
export async function getCodSlippageCalibration(
  client: SupabaseClient,
  developerCompanyId: string | null,
): Promise<ScheduleCalibration | null> {
  if (!developerCompanyId) return getSectorCalibration(client);
  const { data, error } = await client
    .from("schedule_calibration_stat")
    .select("cod_slippage_days_avg, cod_slippage_sample_size")
    .eq("developer_company_id", developerCompanyId)
    .maybeSingle();
  if (error?.code === "42P01" || error?.code === "PGRST205") return null;
  if (error) throw new Error(`Error obteniendo calibración de cronograma: ${error.message}`);
  const sampleSize = (data?.cod_slippage_sample_size as number | null) ?? 0;
  if (data && sampleSize >= MIN_CALIBRATION_SAMPLE_SIZE && data.cod_slippage_days_avg !== null) {
    return { codSlippageDaysAvg: Number(data.cod_slippage_days_avg), sampleSize, scope: "developer" };
  }
  return getSectorCalibration(client);
}
