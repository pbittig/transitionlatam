-- Resolve Supabase linter 0013 without breaking the public market views.
-- Sync/admin tables intentionally receive no client policies; service_role and
-- the direct migration connection bypass RLS.

alter table public._migrations enable row level security;
alter table public.cne_construccion_sync_log enable row level security;

alter table public.construction_project enable row level security;
drop policy if exists construction_project_public_read on public.construction_project;
create policy construction_project_public_read
  on public.construction_project
  for select
  to anon, authenticated
  using (true);

alter table public.cne_capacidad_sync_log enable row level security;
drop policy if exists cne_capacidad_sync_log_public_read on public.cne_capacidad_sync_log;
create policy cne_capacidad_sync_log_public_read
  on public.cne_capacidad_sync_log
  for select
  to anon, authenticated
  using (true);
