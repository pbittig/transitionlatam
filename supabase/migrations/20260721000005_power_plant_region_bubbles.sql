-- Agregación server-side para el gráfico de burbujas Región × Capacidad × Cantidad
-- × Tecnología dominante en Data SEN (cruce de variables estilo consultora).

create or replace function get_power_plant_region_bubbles()
returns table(region text, capacity_mw numeric, plant_count int, dominant_technology text)
language sql
stable
as $$
  with by_region_tech as (
    select
      coalesce(pp.region, 'Sin región') as region,
      coalesce(pp.plant_type, 'Sin clasificar') as plant_type,
      sum(pp.net_capacity_mw) as tech_capacity_mw,
      count(*) as tech_count
    from power_plant pp
    where pp.is_hidden = false and pp.status in ('Operativa', 'Operativa – Autodespacho DS88')
    group by 1, 2
  ),
  region_totals as (
    select region, sum(tech_capacity_mw) as capacity_mw, sum(tech_count)::int as plant_count
    from by_region_tech
    group by region
  ),
  dominant as (
    select distinct on (region) region, plant_type as dominant_technology
    from by_region_tech
    order by region, tech_capacity_mw desc
  )
  select r.region, r.capacity_mw, r.plant_count, d.dominant_technology
  from region_totals r
  join dominant d on d.region = r.region
  order by r.capacity_mw desc;
$$;

grant execute on function get_power_plant_region_bubbles() to anon, authenticated;
