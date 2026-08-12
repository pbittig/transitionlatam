-- Hitos que PGP ya nos venía entregando y que sólo vivían dentro de
-- `source_payload`: se bajan a columnas para poder consultarlos, mostrarlos en
-- la ficha y construir una línea de tiempo con fuente.
--
-- No hay una descarga nueva: el JSON completo de cada solicitud se guarda desde
-- la primera sincronización. El backfill de abajo lee las 280 observaciones ya
-- almacenadas.
--
-- Ojo con la semántica de `service_date` / `operative_date`: son las fechas que
-- el expediente tiene registradas, no necesariamente el hecho consumado. Al
-- 2026-08-12, de 94 proyectos con `operative_date` hay 9 con avance físico
-- menor a 100% — uno con 3%. Se guardan como dato de la fuente; quien las
-- presente como "entró en operación" debe cruzarlas con progress_percent = 100
-- (ver docs/12-ficha-proyecto-datos-reales.md §5).
--
-- `completition_pes` NO se baja a columna a propósito: vale 0 en el 100% de las
-- observaciones, así que no distingue nada.

alter table pgp_project_progress_observation
  add column if not exists reception_date date,
  add column if not exists construction_declaration_date date,
  add column if not exists service_date date,
  add column if not exists operative_date date,
  add column if not exists applicant_name text,
  add column if not exists pgp_project_name text,
  add column if not exists pgp_project_type text,
  add column if not exists pgp_description text;

comment on column pgp_project_progress_observation.service_date is
  'Fecha de puesta en servicio registrada en el expediente PGP. No implica por sí sola que la puesta en servicio ocurrió: contrastar con progress_percent.';
comment on column pgp_project_progress_observation.operative_date is
  'Fecha de entrada en operación registrada en el expediente PGP. Misma advertencia que service_date.';

-- Backfill desde el payload ya guardado. `left(...,10)` porque PGP entrega
-- timestamps ISO ("2026-12-15T00:00:00") y la columna es date.
update pgp_project_progress_observation
set
  reception_date = nullif(left(source_payload->>'reception_date', 10), '')::date,
  construction_declaration_date = nullif(left(source_payload->>'construction_declaration_date', 10), '')::date,
  service_date = nullif(left(source_payload->>'service_date', 10), '')::date,
  operative_date = nullif(left(source_payload->>'operative_date', 10), '')::date,
  applicant_name = source_payload->'applicant'->>'name',
  pgp_project_name = source_payload->>'name',
  pgp_project_type = source_payload->'project_type'->>'name',
  pgp_description = source_payload->>'description'
where source_payload is not null;

create index if not exists pgp_progress_construction_declaration_idx
  on pgp_project_progress_observation (construction_declaration_date)
  where construction_declaration_date is not null;

-- La vista expone la última observación de cada proyecto: se agregan las
-- columnas nuevas para que la ficha no tenga que leer la tabla completa.
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
  operative_estimate_date,
  reception_date,
  construction_declaration_date,
  service_date,
  operative_date,
  applicant_name,
  pgp_project_name,
  pgp_project_type,
  pgp_description
from pgp_project_progress_observation
order by project_id, observed_at desc;
