-- Código de identificación interno corto (no confundir con external_reference/NUP,
-- que son identificadores del Coordinador) — pedido explícito del usuario para poder
-- referenciar proyectos fácilmente. Formato TL-0001, TL-0002, ... asignado en orden
-- de creación para los proyectos existentes; los nuevos lo reciben automáticamente
-- vía el default de la secuencia, sin cambios en el código de ingesta.
create sequence if not exists project_internal_code_seq;

alter table project add column if not exists internal_code text;

with numbered as (
  select id, row_number() over (order by created_at, id) as rn
  from project
  where internal_code is null
)
update project set internal_code = 'TL-' || lpad(numbered.rn::text, 4, '0')
from numbered
where project.id = numbered.id;

select setval('project_internal_code_seq', (select count(*) from project), true);

alter table project
  alter column internal_code set default ('TL-' || lpad(nextval('project_internal_code_seq')::text, 4, '0')),
  alter column internal_code set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_internal_code_unique'
  ) then
    alter table project add constraint project_internal_code_unique unique (internal_code);
  end if;
end $$;
