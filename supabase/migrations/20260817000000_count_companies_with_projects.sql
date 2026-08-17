-- Cuántas empresas tienen al menos un proyecto.
--
-- Es el primer indicador de /propietarios. Va como función porque PostgREST no
-- cuenta valores distintos: pedirlo desde la app obligaría a traer los 2.096
-- `developer_company_id` para contarlos únicos en memoria, en cada carga.
--
-- Cuenta empresas con proyecto PUBLICADO, no con cualquier proyecto: es la
-- misma base que la tabla de más abajo en esa pantalla, y un total que no cuadra
-- con la lista que lo acompaña se lee como un error aunque los dos números sean
-- correctos por separado.

create or replace function count_companies_with_projects()
returns integer
language sql
stable
as $$
  select count(distinct developer_company_id)::int
  from project
  where developer_company_id is not null and editorial_status = 'published';
$$;
