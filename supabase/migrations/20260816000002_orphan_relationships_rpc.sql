-- Los vínculos de `entity_relationship` que apuntan a algo que ya no existe.
--
-- POR QUÉ EXISTEN: la tabla guarda el par (tipo, id) en columnas genéricas, sin
-- llave foránea. Postgres no puede protegerla — borrar un proyecto o una empresa
-- no arrastra sus vínculos ni avisa que quedaron colgando. Medido el
-- 2026-08-16: 385 con el proyecto de origen borrado, 608 con el de destino, y 6
-- apuntando a empresas que se eliminaron en las limpiezas de julio.
--
-- POR QUÉ UNA FUNCIÓN Y NO UNA CONSULTA DESDE LA APP: la pregunta es "no existe
-- en la otra tabla", y PostgREST no expresa un NOT EXISTS contra una tabla que
-- no está relacionada por llave foránea. Sin esto habría que traer las ~10.000
-- filas de entity_relationship al servidor para filtrarlas en memoria en cada
-- carga de la página.
--
-- `security definer` con search_path fijo: la usa solo /admin/huerfanos, que ya
-- valida isAdmin() y consulta con service_role. El search_path explícito evita
-- que un esquema en el camino de búsqueda cambie a qué tablas mira.

create or replace function get_orphan_relationships(limite int default 100)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with huerfanos as (
    select er.id, er.relationship_type, er.source_type, er.created_at,
           case
             when er.target_type = 'company' then 'company_target'
             when er.source_type = 'project' then 'project_source'
             else 'project_target'
           end as kind,
           -- El nombre de la punta que sigue viva, para que la fila se pueda leer.
           coalesce(p.name, pe.full_name, s.name) as origen
    from entity_relationship er
    left join project p on er.source_type = 'project' and p.id = er.source_id
    left join person pe on er.source_type = 'person' and pe.id = er.source_id
    left join spv s on er.source_type = 'spv' and s.id = er.source_id
    where (er.target_type = 'company' and not exists (select 1 from company c where c.id = er.target_id))
       or (er.source_type = 'project' and not exists (select 1 from project x where x.id = er.source_id))
       or (er.target_type = 'project' and not exists (select 1 from project x where x.id = er.target_id))
  ),
  numeradas as (
    select *, row_number() over (partition by kind order by created_at) as fila from huerfanos
  )
  select json_build_object(
    'items', coalesce((
      select json_agg(row_to_json(n) order by n.kind, n.created_at)
      from numeradas n where n.fila <= limite
    ), '[]'::json),
    'totales', json_build_object(
      'company_target', (select count(*) from huerfanos where kind = 'company_target'),
      'project_source', (select count(*) from huerfanos where kind = 'project_source'),
      'project_target', (select count(*) from huerfanos where kind = 'project_target')
    )
  );
$$;
