-- Agregación server-side para dashboard y mapa. PostgREST devuelve como máximo
-- 1000 filas por consulta sin paginar por defecto — traer todas las filas a
-- Node para sumarlas ahí las trunca silenciosamente (sin error) apenas el
-- dataset supera esa cifra. La agregación debe vivir en SQL, no en la app.

create or replace function get_dashboard_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalProjects', (select count(*) from project),
    'totalCapacityMw', (select coalesce(sum(capacity_mw), 0) from project),
    'totalCapacityMwh', (select coalesce(sum(capacity_mwh), 0) from project),
    'byTechnology', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select coalesce(technology.name, 'Sin clasificar') as technology,
               count(*)::int as count,
               coalesce(sum(project.capacity_mw), 0) as "capacityMw"
        from project
        left join technology on technology.id = project.technology_id
        group by technology.name
      ) t
    ),
    'byRegion', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json) from (
        select coalesce(region.name, 'Sin región') as region, count(*)::int as count
        from project
        left join location on location.id = project.location_id
        left join region on region.id = location.region_id
        group by region.name
      ) r
    ),
    'byStatus', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json) from (
        select coalesce(status, 'Sin estado') as status, count(*)::int as count
        from project
        group by status
        order by count(*) desc
      ) s
    ),
    'byConnectionYear', (
      select coalesce(json_agg(row_to_json(y)), '[]'::json) from (
        select extract(year from estimated_connection_date)::int as year,
               count(*)::int as count,
               coalesce(sum(capacity_mw), 0) as "capacityMw"
        from project
        where estimated_connection_date is not null
          and extract(year from estimated_connection_date) between 2024 and 2032
        group by 1
        order by 1
      ) y
    )
  );
$$;

create or replace function get_map_region_bubbles(p_technology_code text default null)
returns table(region text, count int, capacity_mw numeric)
language sql
stable
as $$
  select coalesce(r.name, 'Sin región') as region, count(*)::int as count, coalesce(sum(p.capacity_mw), 0) as capacity_mw
  from project p
  left join location l on l.id = p.location_id
  left join region r on r.id = l.region_id
  left join technology t on t.id = p.technology_id
  where (p_technology_code is null or t.code = p_technology_code)
    and (l.latitude is null or l.longitude is null)
  group by r.name;
$$;

grant execute on function get_dashboard_stats() to anon, authenticated;
grant execute on function get_map_region_bubbles(text) to anon, authenticated;
