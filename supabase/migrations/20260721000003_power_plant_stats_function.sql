-- Agregación server-side para la sección SEN (Sistema Eléctrico Nacional).
-- Mismo motivo que get_dashboard_stats(): el cap de 1000 filas de PostgREST
-- obliga a sumar en SQL, no trayendo todo a Node.

create or replace function get_power_plant_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalPlants', (select count(*) from power_plant where is_hidden = false),
    'operatingCapacityMw', (
      select coalesce(sum(net_capacity_mw), 0) from power_plant
      where is_hidden = false and status in ('Operativa', 'Operativa – Autodespacho DS88')
    ),
    'renewableCapacityMw', (
      select coalesce(sum(net_capacity_mw), 0) from power_plant
      where is_hidden = false and is_renewable = true
        and status in ('Operativa', 'Operativa – Autodespacho DS88')
    ),
    'underConstructionCount', (
      select count(*) from power_plant where is_hidden = false and status = 'En Construcción'
    ),
    'underConstructionCapacityMw', (
      select coalesce(sum(net_capacity_mw), 0) from power_plant
      where is_hidden = false and status = 'En Construcción'
    ),
    'byTechnology', (
      select coalesce(json_agg(row_to_json(t)), '[]'::json) from (
        select coalesce(plant_type, 'Sin clasificar') as technology,
               count(*)::int as count,
               coalesce(sum(net_capacity_mw), 0) as "capacityMw"
        from power_plant
        where is_hidden = false and status in ('Operativa', 'Operativa – Autodespacho DS88')
        group by plant_type
        order by 3 desc
      ) t
    ),
    'byStatus', (
      select coalesce(json_agg(row_to_json(s)), '[]'::json) from (
        select coalesce(status, 'Sin estado') as status,
               count(*)::int as count,
               coalesce(sum(net_capacity_mw), 0) as "capacityMw"
        from power_plant
        where is_hidden = false
        group by status
        order by 3 desc
      ) s
    )
  );
$$;

grant execute on function get_power_plant_stats() to anon, authenticated;
