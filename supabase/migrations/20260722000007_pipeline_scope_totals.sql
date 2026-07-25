-- Totales reales (count + MW) para el mini-resumen sobre la tabla de
-- Pipeline, por pestaña ("Esperados"/"Histórico") — agregado en SQL porque
-- "Histórico" puede superar las 1000 filas que PostgREST permite traer sin
-- paginar (sumar en Node undercontaría en silencio). Replica exactamente los
-- mismos criterios que ya usan listProjects (connectionPeriod) y
-- get_connection_calendar (startOfCurrentMonthIso/todayIso), para que el
-- número coincida con lo que el usuario ve en la tabla.

create or replace function get_pipeline_scope_totals()
returns json
language sql
stable
as $$
  select json_build_object(
    'esperados', (
      select json_build_object('count', count(*), 'totalCapacityMw', coalesce(sum(capacity_mw), 0))
      from project
      where estimated_connection_date >= date_trunc('month', now())
        and status not in ('Rechazada', 'Desistida')
    ),
    'historico', (
      select json_build_object('count', count(*), 'totalCapacityMw', coalesce(sum(capacity_mw), 0))
      from project
      where (estimated_connection_date < current_date and estimated_connection_date is not null)
         or status in ('Rechazada', 'Desistida')
    )
  );
$$;

grant execute on function get_pipeline_scope_totals() to anon, authenticated;
