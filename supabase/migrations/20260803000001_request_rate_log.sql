-- Base para detección de scraping/abuso (ver docs/09-seguridad.md §9.4/§9.6).
-- Cada fila es un evento de "bucket" (ej. project_view, project_list) para un
-- identificador (hoy: user_profile_id de una cuenta con sesión — anónimos no
-- se trackean acá, mismo criterio que behavior_event). No implementa bloqueo
-- automático, solo el conteo que permite detectar y alertar (MVP explícito:
-- alerta + rate limit más agresivo temporal, no baneo de cuenta).
create table request_rate_log (
  id bigint generated always as identity primary key,
  identifier text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index request_rate_log_identifier_bucket_idx on request_rate_log (identifier, bucket, created_at desc);

alter table request_rate_log enable row level security;
