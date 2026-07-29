-- Registro auditable de la pre-verificación asistida por IA.
-- No participa del acto humano de verificación: esta tabla no tiene trigger ni
-- escritura alguna sobre project.verified_at.
create table if not exists project_preverification (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project (id) on delete cascade,
  run_id uuid not null,
  mode text not null check (mode in ('dry_run', 'apply')),
  status text not null check (status in ('completed', 'partial', 'error')),
  report jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists project_preverification_project_created_idx
  on project_preverification (project_id, created_at desc);
create index if not exists project_preverification_run_idx
  on project_preverification (run_id);

alter table project_preverification enable row level security;
-- Sin políticas para anon/authenticated: contiene evidencia y motivos que
-- pueden incluir datos de contacto. Igual que las escrituras de ingesta, se
-- consulta exclusivamente desde tooling/admin server-side con service_role.
