-- Physical construction progress published in the Coordinador's PGP.
-- Kept separate from project.status: "declarado en construcción" closes the
-- connection-request workflow, while this percentage describes reported works.

create table if not exists pgp_project_progress_observation (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project(id) on delete cascade,
  nup text not null,
  progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  declared_cod_snapshot date,
  project_status_snapshot text,
  expected_progress_percent numeric(5,2) check (expected_progress_percent between 0 and 100),
  deviation_pp numeric(6,2),
  model_version text,
  observed_at timestamptz not null default now(),
  source_url text not null,
  source_payload jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, observed_at)
);

create index if not exists pgp_progress_project_observed_idx
  on pgp_project_progress_observation(project_id, observed_at desc);
create index if not exists pgp_progress_nup_idx
  on pgp_project_progress_observation(nup);

alter table pgp_project_progress_observation enable row level security;

create policy "Authenticated users can read PGP progress"
  on pgp_project_progress_observation for select
  to authenticated
  using (true);

create or replace view latest_pgp_project_progress
with (security_invoker = true) as
select distinct on (project_id)
  project_id,
  nup,
  progress_percent,
  declared_cod_snapshot,
  expected_progress_percent,
  deviation_pp,
  model_version,
  observed_at,
  source_url
from pgp_project_progress_observation
order by project_id, observed_at desc;
