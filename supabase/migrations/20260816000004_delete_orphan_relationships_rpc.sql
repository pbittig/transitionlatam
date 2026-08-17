-- Borra los vínculos cuyo proyecto ya no existe, y devuelve cuántos fueron.
--
-- Se hace en la base y no en la aplicación por lo mismo que la consulta: la
-- condición es "no existe en la otra tabla", y PostgREST no expresa un NOT
-- EXISTS contra una tabla sin llave foránea. Hacerlo desde la app obligaría a
-- traer las ~10.000 filas de entity_relationship para filtrarlas en memoria y
-- después borrarlas por id — más lento y, peor, sujeto a que la lista quede
-- vieja entre que se calcula y se borra.
--
-- NO toca los que perdieron la empresa. Esos tienen un origen vivo y una
-- decisión pendiente (a qué empresa corresponden ahora); se revisan uno a uno
-- en /admin/huerfanos. Acá solo se limpia lo que no tiene a qué reapuntar.

create or replace function delete_orphan_relationships_of_deleted_projects()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  borrados integer;
begin
  with eliminadas as (
    delete from entity_relationship er
    where (er.source_type = 'project' and not exists (select 1 from project x where x.id = er.source_id))
       or (er.target_type = 'project' and not exists (select 1 from project x where x.id = er.target_id))
    returning 1
  )
  select count(*) into borrados from eliminadas;
  return borrados;
end;
$$;
