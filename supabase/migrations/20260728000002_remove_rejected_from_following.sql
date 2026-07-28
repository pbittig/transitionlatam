-- Un proyecto terminal negativo deja de pertenecer automáticamente al radar.
-- La limpieza inicial cubre filas existentes; el trigger mantiene la regla ante
-- cambios futuros provenientes de ingesta o edición administrativa.

delete from followed_project fp
using project p
where p.id = fp.project_id
  and lower(trim(coalesce(p.status, ''))) in (
    'rechazada',
    'rechazado',
    'desistida',
    'desistido'
  );

create or replace function remove_terminal_project_from_following()
returns trigger
language plpgsql
as $$
begin
  if lower(trim(coalesce(new.status, ''))) in (
    'rechazada',
    'rechazado',
    'desistida',
    'desistido'
  ) then
    delete from followed_project where project_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists project_remove_from_following_on_terminal_status on project;
create trigger project_remove_from_following_on_terminal_status
after insert or update of status on project
for each row
execute function remove_terminal_project_from_following();
