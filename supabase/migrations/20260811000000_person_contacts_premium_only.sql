-- Los contactos dejan de ser legibles por cualquier usuario autenticado.
--
-- Regla de negocio confirmada: los datos de contacto son de plan Prime.
-- Hasta ahora eso se aplicaba solo en la UI (getIsFreeTier en
-- lib/entitlements/isFreeTier.ts), mientras la política de base de datos
-- autorizaba a TODO rol `authenticated`. Como la anon key viaja al navegador,
-- cualquier usuario con una cuenta gratuita podía consultar la tabla `person`
-- directamente por REST y llevarse todos los contactos, sin pasar por la app.
-- Es el hallazgo "Alto" de docs/security-audit-2026-07-29.md.
--
-- Por qué esta política y no simplemente borrar la anterior: casi todas las
-- lecturas de `person` usan createSupabaseServiceClient(), que ignora RLS y no
-- se ve afectado. Pero /crm consulta con la sesión del propio usuario cuando
-- es Prime (ver app/(public)/crm/page.tsx), así que ese camino sí necesita una
-- política — acotada al plan que corresponde.
--
-- Mismo patrón que ya usa `opportunity` en 20260803000002_private_crm_mvp.sql.

drop policy if exists authenticated_read on person;
drop policy if exists premium_read on person;

create policy premium_read on person for select using (
  exists (
    select 1 from user_profile up join plan p on p.id = up.plan_id
    where up.auth_user_id = auth.uid() and p.code = 'premium'
  )
);
