-- Permite filtrar las burbujas del mapa por varios códigos de tecnología a la
-- vez (chips multi-select en Proyectos Actuales/Esperados), no solo uno.

drop function if exists get_map_region_bubbles(text);

create or replace function get_map_region_bubbles(p_technology_codes text[] default null)
returns table(region text, count int, capacity_mw numeric)
language sql
stable
as $$
  select coalesce(r.name, 'Sin región') as region, count(*)::int as count, coalesce(sum(p.capacity_mw), 0) as capacity_mw
  from project p
  left join location l on l.id = p.location_id
  left join region r on r.id = l.region_id
  left join technology t on t.id = p.technology_id
  where (p_technology_codes is null or t.code = any(p_technology_codes))
    and (l.latitude is null or l.longitude is null)
  group by r.name;
$$;

grant execute on function get_map_region_bubbles(text[]) to anon, authenticated;
