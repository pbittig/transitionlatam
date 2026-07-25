-- Registro de autoservicio (free trial 14 días) — se apoya en el modelo de
-- entitlements ya existente (plan/user_profile/resolveEntitlements, ver
-- docs/08-modelo-suscripciones.md) en vez de crear un sistema paralelo.
-- Faltaban dos cosas para que un usuario nuevo pueda registrarse solo:
-- 1) una fecha de vencimiento de trial en user_profile (no existía);
-- 2) una política de INSERT en user_profile (solo había select/update —
--    sin esto, un usuario recién autenticado no puede crear su propia fila).

alter table user_profile add column if not exists trial_ends_at timestamptz;

create policy own_profile_insert on user_profile
  for insert with check (auth.uid() = auth_user_id);
