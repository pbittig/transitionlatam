-- Estimated Puesta en Servicio / Entrada en Operación dates reported by the
-- Coordinador's PGP for each tracked project. "Real" (actual) dates are not
-- exposed as a field by the PGP API yet — investigated and confirmed absent;
-- both columns stay null until the first project reaches that milestone and
-- we can find out what field the PGP populates then.

alter table pgp_project_progress_observation
  add column if not exists service_estimate_date date,
  add column if not exists operative_estimate_date date;

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
  source_url,
  service_estimate_date,
  operative_estimate_date
from pgp_project_progress_observation
order by project_id, observed_at desc;
