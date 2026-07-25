-- Embudo del pipeline y calendario de conexiones — capa de "inteligencia" que
-- pidió el usuario, calculada 100% sobre datos ya cargados (project +
-- seia_record), sin fuentes nuevas. Agregación en SQL, no en Node, por el
-- mismo motivo que el resto de las funciones get_*_stats: PostgREST tapa en
-- 1000 filas sin paginar, y aquí necesitamos contar sobre las 2.758+ filas.

create extension if not exists unaccent;

create or replace function get_pipeline_funnel()
returns json
language sql
stable
as $$
  select json_build_object(
    'total', (select count(*) from project),
    'noRechazado', (
      select count(*) from project
      where lower(unaccent(status)) not in ('rechazada', 'desistida')
    ),
    'conSeia', (
      select count(distinct p.id) from project p
      join seia_record s on s.project_id = p.id
      where lower(unaccent(p.status)) not in ('rechazada', 'desistida')
    ),
    'conRca', (
      select count(distinct p.id) from project p
      join seia_record s on s.project_id = p.id
      where lower(unaccent(p.status)) not in ('rechazada', 'desistida')
        and s.status ilike '%aprobad%'
    ),
    'etapaAvanzada', (
      select count(*) from project
      where lower(unaccent(status)) in (
        'proyecto fehaciente debe presentar suctd', 'proyecto calificado como fehaciente',
        'elaboracion de informe de autorizacion de conexion final',
        'elaboracion de informe de autorizacion de conexion proyecto fehaciente',
        'proyecto autorizado para declararse en construccion',
        'detenida a la espera de definicion de ingenieria de la obra',
        'detenida a la espera de informacion tecnica del propietario de la instalacion',
        'proyecto declarado en construccion', 'clasificado como obra menor',
        'proyecto finalizado'
      )
    ),
    'declaradoConstruccion', (
      select count(*) from project
      where lower(unaccent(status)) in ('proyecto declarado en construccion', 'clasificado como obra menor', 'proyecto finalizado')
    )
  );
$$;

create or replace function get_connection_calendar(months_ahead integer default 24)
returns table(year_month text, count int, capacity_mw numeric)
language sql
stable
as $$
  select to_char(date_trunc('month', estimated_connection_date), 'YYYY-MM') as year_month,
         count(*)::int as count,
         coalesce(sum(capacity_mw), 0) as capacity_mw
  from project
  where estimated_connection_date is not null
    and lower(unaccent(status)) not in ('rechazada', 'desistida')
    and estimated_connection_date >= date_trunc('month', now())
    and estimated_connection_date < date_trunc('month', now()) + (months_ahead || ' months')::interval
  group by 1
  order by 1;
$$;

grant execute on function get_pipeline_funnel() to anon, authenticated;
grant execute on function get_connection_calendar(integer) to anon, authenticated;
