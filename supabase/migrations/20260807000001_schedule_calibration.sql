-- Gradual, data-driven calibration for the theoretical schedule model.
-- Layered on top of (never replacing) the hand-curated durations in
-- lib/shared/projectPhaseDurations.ts — that file stays the source of truth
-- for defaults; this table only nudges the COD used for the backward
-- calculation, per developer, once there's enough real history to trust it.
--
-- Recomputed from scratch on every cron run (see
-- lib/analytics/scheduleCalibration.ts) from data that's already being
-- collected: project_event (status_change, connection_date_change) and
-- pgp_project_progress_observation. Sample sizes are tiny today by design —
-- this self-improves as more projects reach construction and get confirmed
-- in PGP, it is not meant to be hand-edited.

create table if not exists schedule_calibration_stat (
  id uuid primary key default gen_random_uuid(),
  -- null = sector-wide fallback row, used when a developer doesn't have
  -- enough history of its own yet.
  developer_company_id uuid references company(id) on delete cascade,
  cod_slippage_days_avg numeric,
  cod_slippage_sample_size integer not null default 0,
  construction_lag_days_avg numeric,
  construction_lag_days_median numeric,
  construction_lag_sample_size integer not null default 0,
  computed_at timestamptz not null default now()
);

create index if not exists schedule_calibration_stat_developer_idx
  on schedule_calibration_stat (developer_company_id);

alter table schedule_calibration_stat enable row level security;

create policy "Authenticated users can read schedule calibration"
  on schedule_calibration_stat for select
  to authenticated
  using (true);
