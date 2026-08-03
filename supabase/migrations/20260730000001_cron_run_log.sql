create table cron_run_log (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null check (status in ('running', 'success', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  batch_size integer,
  eligible_rows integer,
  processed_in_cycle integer,
  remaining_rows integer,
  priority_new_rows integer,
  projects_created integer,
  projects_updated integer,
  projects_promoted integer,
  requests_discarded integer,
  events_failed integer,
  cycle_complete boolean,
  next_cursor text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index cron_run_log_job_started_idx on cron_run_log (job_name, started_at desc);
create index cron_run_log_status_started_idx on cron_run_log (status, started_at desc);

alter table cron_run_log enable row level security;
