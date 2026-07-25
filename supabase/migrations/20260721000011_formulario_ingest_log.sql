-- Registro de qué proyectos ya se intentaron procesar para el Formulario
-- (Nivel 2) descargado automáticamente desde Acceso Abierto — para no volver
-- a descargar/parsear todo en cada corrida y poder reintentar solo los que
-- fallaron.

create table formulario_ingest_log (
  project_id uuid primary key references project (id),
  solicitud_id text not null,
  document_id integer,
  status text not null check (status in ('success', 'no_documents', 'no_formulario', 'download_error', 'parse_error')),
  error_message text,
  processed_at timestamptz not null default now()
);

alter table formulario_ingest_log enable row level security;
create policy formulario_ingest_log_public_read on formulario_ingest_log for select using (true);
