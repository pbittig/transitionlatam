-- Consolida los 4 niveles originales (free/professional/business/enterprise) a
-- los 3 que el negocio realmente usa: Free, Lite, Premium (decisión confirmada
-- con el usuario 2026-07-28 — Lite y Premium tienen el mismo acceso por ahora,
-- se diferencian más adelante). 'professional' pasa a 'lite', 'business' pasa
-- a 'premium'; 'enterprise' se fusiona en 'premium' (sin plan_feature propio,
-- solo un perfil de usuario que se reasigna antes de soltar el código viejo).
alter table plan drop constraint plan_code_check;

update plan set code = 'lite', name = 'Lite' where code = 'professional';
update plan set code = 'premium', name = 'Premium' where code = 'business';

update user_profile
set plan_id = (select id from plan where code = 'premium')
where plan_id = (select id from plan where code = 'enterprise');

delete from plan where code = 'enterprise';

alter table plan add constraint plan_code_check check (code in ('free', 'lite', 'premium'));
