-- Benchmark honesto de "antigüedad de la solicitud" — NO es "tiempo de
-- tramitación completo" (no tenemos fechas de transición de estado, solo el
-- estado actual y la fecha real de ingreso, ver project_event event_type=
-- 'announced'). Es tiempo transcurrido desde el ingreso hasta hoy, para
-- solicitudes vigentes (no rechazadas/desistidas) — se etiqueta como tal en
-- la UI. Agregado en SQL por el mismo motivo que el resto de get_*_stats:
-- PostgREST tapa en 1000 filas y hay 2758+ solicitudes.

create or replace function get_request_age_benchmarks()
returns json
language sql
stable
as $$
  with base as (
    select
      p.id,
      p.capacity_mw,
      t.name as technology,
      r.name as region,
      extract(epoch from (now() - e.occurred_at)) / (86400 * 30.44) as age_months
    from project p
    join project_event e on e.project_id = p.id and e.event_type = 'announced'
    left join technology t on t.id = p.technology_id
    left join location l on l.id = p.location_id
    left join region r on r.id = l.region_id
    where lower(unaccent(p.status)) not in ('rechazada', 'desistida')
  )
  select json_build_object(
    'byTechnology', (
      select coalesce(json_agg(row_to_json(x) order by x.avg_age_months desc), '[]'::json)
      from (
        select technology, round(avg(age_months)::numeric, 1) as avg_age_months, count(*)::int as count
        from base
        where technology is not null
        group by technology
        having count(*) >= 5
      ) x
    ),
    'byRegion', (
      select coalesce(json_agg(row_to_json(x) order by x.avg_age_months desc), '[]'::json)
      from (
        select region, round(avg(age_months)::numeric, 1) as avg_age_months, count(*)::int as count
        from base
        where region is not null
        group by region
        having count(*) >= 5
      ) x
    ),
    'byPmgdUtility', (
      select coalesce(json_agg(row_to_json(x) order by x.category), '[]'::json)
      from (
        select
          case when capacity_mw <= 9 then 'PMGD' else 'Utility' end as category,
          round(avg(age_months)::numeric, 1) as avg_age_months,
          count(*)::int as count
        from base
        where capacity_mw is not null
        group by 1
      ) x
    ),
    'bySizeBucket', (
      select coalesce(json_agg(row_to_json(x)), '[]'::json)
      from (
        select bucket, round(avg(age_months)::numeric, 1) as avg_age_months, count(*)::int as count
        from (
          select
            age_months,
            case
              when capacity_mw < 20 then '< 20 MW'
              when capacity_mw < 100 then '20-100 MW'
              when capacity_mw < 300 then '100-300 MW'
              else '> 300 MW'
            end as bucket,
            case
              when capacity_mw < 20 then 1
              when capacity_mw < 100 then 2
              when capacity_mw < 300 then 3
              else 4
            end as bucket_order
          from base
          where capacity_mw is not null
        ) y
        group by bucket, bucket_order
        order by bucket_order
      ) x
    )
  );
$$;

grant execute on function get_request_age_benchmarks() to anon, authenticated;
