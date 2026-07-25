-- Corrige la migración anterior (20260722000005): el usuario aclaró que
-- "Transmisión, Minería, Desaladora" se refería, en la práctica, a toda la
-- tecnología "Consumo" (technology_id='consumption') — casi todos esos
-- subtipos caen ahí y no tienen código propio. Simplifica la política a
-- ocultar TODO 'consumption' + 'transmission', EXCEPTO los proyectos que
-- matchean el patrón de "Data Center" (mismo patrón que ya usa ese chip en
-- techChips.ts) — el usuario confirmó explícitamente que Data Center debe
-- seguir visible.

drop policy if exists public_read on project;

create policy public_read on project for select using (
  technology_id is distinct from (select id from technology where code = 'transmission')
  and (
    technology_id is distinct from (select id from technology where code = 'consumption')
    or unaccent(lower(name)) ~ '(data center|datacenter|centro de datos)'
  )
);
