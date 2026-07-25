-- Campos adicionales sobre `seia_record` (existente desde la Fase 0) para poder
-- ingerir el universo completo de expedientes SEIA y hacer el cruce contra
-- `project` — la tabla original solo tenía espacio para un registro YA
-- vinculado a un proyecto (project_id), no para guardar candidatos sin matchear
-- todavía (necesario: primero se ingiere todo, después se cruza).

alter table seia_record
  add column if not exists nombre text,
  add column if not exists name_normalized text,
  add column if not exists region text,
  add column if not exists comuna text,
  add column if not exists tipo_proyecto_code text,
  add column if not exists descripcion_tipologia text,
  add column if not exists url_ficha text,
  add column if not exists match_confidence text check (match_confidence in ('alta', 'media', 'baja')),
  add column if not exists match_method text,
  add column if not exists synced_at timestamptz not null default now();

alter table seia_record add constraint seia_record_seia_id_unique unique (seia_id);

create index if not exists seia_record_name_normalized_idx on seia_record (name_normalized);
create index if not exists seia_record_region_idx on seia_record (region);
