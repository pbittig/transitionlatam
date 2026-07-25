-- Lista de seguimiento ("watchlist") para el admin — solo hay un usuario admin
-- por ahora (ver lib/auth/session.ts), así que no se modela por usuario, es una
-- sola lista global. Las mutaciones y lecturas van siempre por el cliente de
-- servicio, gateadas por isAdmin() en los Server Actions (mismo patrón que
-- seiaActions.ts) — no queda expuesta a anon.
create table if not exists followed_project (
  project_id uuid primary key references project(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table followed_project enable row level security;
-- Sin políticas para anon/authenticated: solo el cliente de servicio (service_role) accede.
