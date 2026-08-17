-- Corrige cómo se clasifican los vínculos huérfanos.
--
-- La primera versión (20260816000002) decidía la clase por el TIPO de las
-- puntas y no por CUÁL falta. Como el `case` miraba primero
-- `target_type = 'company'`, los 385 vínculos cuyo proyecto de origen se había
-- borrado —y que además apuntaban a una empresa— caían en la clase "falta la
-- empresa", y el grupo que de verdad necesita decisión humana quedaba mezclado
-- con residuo: 391 en vez de 6.
--
-- La distinción importa porque las dos clases se arreglan distinto. Si falta la
-- empresa pero el origen vive, hay algo que decidir: a qué empresa corresponde
-- ahora. Si falta el proyecto, no hay a qué reapuntar y lo único sensato es
-- quitar el vínculo. Mezclarlas obliga a revisar a mano 391 filas de las que
-- 385 no tienen ninguna decisión que tomar.
--
-- Ahora se clasifica por existencia real de cada punta, y "falta el proyecto"
-- gana sobre "falta la empresa": si el proyecto de origen ya no está, el
-- vínculo es residuo aunque la empresa también falte.

create or replace function get_orphan_relationships(limite int default 100)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with evaluadas as (
    select er.id, er.relationship_type, er.source_type, er.created_at,
           (er.source_type = 'project' and not exists (select 1 from project x where x.id = er.source_id)) as falta_proyecto_origen,
           (er.target_type = 'project' and not exists (select 1 from project x where x.id = er.target_id)) as falta_proyecto_destino,
           (er.target_type = 'company' and not exists (select 1 from company c where c.id = er.target_id)) as falta_empresa,
           coalesce(p.name, pe.full_name, s.name) as origen
    from entity_relationship er
    left join project p on er.source_type = 'project' and p.id = er.source_id
    left join person pe on er.source_type = 'person' and pe.id = er.source_id
    left join spv s on er.source_type = 'spv' and s.id = er.source_id
  ),
  huerfanos as (
    select id, relationship_type, source_type, created_at, origen,
           case
             -- El proyecto manda: sin él no hay a qué reapuntar, aunque además
             -- falte la empresa.
             when falta_proyecto_origen or falta_proyecto_destino then 'project_gone'
             else 'company_target'
           end as kind
    from evaluadas
    where falta_proyecto_origen or falta_proyecto_destino or falta_empresa
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
      'project_gone', (select count(*) from huerfanos where kind = 'project_gone')
    )
  );
$$;
