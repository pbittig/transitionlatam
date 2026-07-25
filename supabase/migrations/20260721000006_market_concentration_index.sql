-- Índice Herfindahl-Hirschman (HHI) de concentración de mercado por capacidad
-- instalada — primer "índice de la industria" de la plataforma. Escala 0-10000:
-- <1500 baja concentración, 1500-2500 moderada, >2500 alta (umbrales estándar,
-- mismos que usa el Departamento de Justicia de EE.UU. para revisión de fusiones).

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
    ),
    'topOwners', (
      select coalesce(json_agg(row_to_json(o)), '[]'::json) from (
        select owner_name as owner,
               count(*)::int as "plantCount",
               coalesce(sum(net_capacity_mw), 0) as "capacityMw"
        from power_plant
        where is_hidden = false and status in ('Operativa', 'Operativa – Autodespacho DS88')
          and owner_name is not null
        group by owner_name
        order by 3 desc
        limit 15
      ) o
    ),
    'marketConcentrationIndex', (
      select coalesce(sum(share_pct ^ 2), 0) from (
        select
          100.0 * sum(net_capacity_mw) / nullif((
            select sum(net_capacity_mw) from power_plant
            where is_hidden = false and status in ('Operativa', 'Operativa – Autodespacho DS88')
          ), 0) as share_pct
        from power_plant
        where is_hidden = false and status in ('Operativa', 'Operativa – Autodespacho DS88')
          and owner_name is not null
        group by owner_name
      ) shares
    )
  );
$$;

grant execute on function get_power_plant_stats() to anon, authenticated;
