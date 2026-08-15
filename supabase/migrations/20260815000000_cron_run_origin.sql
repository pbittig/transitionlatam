-- Distinguir una corrida operativa de un ensayo a mano.
--
-- `cron_run_log` no sabía quién disparó cada corrida, así que probar un script
-- desde la consola ensuciaba /admin/operacion igual que una caída real. Pasó el
-- 2026-08-14: `check-project-visibility` se estrenó a mano ANTES de aplicar la
-- migración que hace cumplir las reglas —o sea, falló a propósito— y el panel
-- lo contó como incidente. El usuario decidió no borrar la fila y arreglar la
-- clasificación, que es lo correcto: el problema no era el registro, era que no
-- distinguía.
--
-- EL DEFAULT ES 'manual' A PROPÓSITO. Una corrida se declara operativa; no se
-- asume. `run-syncs.ps1` exporta TL_RUN_ORIGIN=scheduled para sus hijos, y
-- cualquier otra invocación —consola, una prueba, un script nuevo que nadie
-- conectó todavía— cae en 'manual'. Al revés sería peor: un job que se olvide
-- de declararse se contaría como operativo y su silencio se leería como salud.
--
-- BACKFILL: todo lo que ya existe pasa a 'scheduled'. Son corridas de los cron
-- de Vercel y del runner del VPS, anteriores a que este concepto existiera. La
-- excepción conocida es la fila del 2026-08-14 mencionada arriba, que queda
-- marcada como operativa hasta que expire sola de la ventana de 7 días — se
-- prefirió eso antes que tocar el historial a mano.
--
-- `preverify-editorial-simulacion` sigue siendo un job_name aparte y no se
-- reemplaza por este campo: son ejes distintos. `origin` dice quién disparó la
-- corrida; ese nombre dice que la corrida no aplicó nada. Una simulación
-- programada y una corrida real a mano son ambas posibles.

alter table cron_run_log
  add column if not exists origin text not null default 'manual';

update cron_run_log set origin = 'scheduled' where origin = 'manual';

alter table cron_run_log
  drop constraint if exists cron_run_log_origin_check;
alter table cron_run_log
  add constraint cron_run_log_origin_check check (origin in ('scheduled', 'manual'));

create index if not exists cron_run_log_origin_started_at_idx
  on cron_run_log (origin, started_at desc);

-- El panel pasa a mirar solo lo operativo.
--
-- `latestRunPerJob` y `errorsLast7Days` se acotan a origin='scheduled': una
-- prueba a mano ya no puede pisar la última corrida de un job ni sumar a su
-- contador de errores. Los ensayos siguen guardados y consultables; lo que
-- cambia es que dejan de ser el semáforo.
create or replace function get_admin_operational_metrics()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalProjects', (select count(*) from project where editorial_status = 'published'),
    'verifiedProjects', (select count(*) from project where verified_at is not null),
    'editorialPending', (select count(*) from project where editorial_status = 'pending'),
    'editorialExcluded', (select count(*) from project where editorial_status = 'excluded'),
    'needsReverification', (select count(*) from project where needs_reverification = true),
    'coverage', json_build_object(
      'seia', (select count(distinct project_id) from seia_record),
      'pertinencia', (select count(distinct matched_project_id) from pertinencia_consulta where match_status = 'confirmed'),
      'pgp', (select count(distinct project_id) from latest_pgp_project_progress),
      'ownership', (select count(distinct project_id) from project_ownership_profile)
    ),
    'latestRunPerJob', (
      select coalesce(json_agg(row_to_json(j) order by j."jobName"), '[]'::json) from (
        select distinct on (job_name)
          job_name as "jobName",
          status,
          started_at as "startedAt",
          finished_at as "finishedAt",
          duration_ms as "durationMs",
          error_message as "errorMessage"
        from cron_run_log
        where origin = 'scheduled'
        order by job_name, started_at desc
      ) j
    ),
    'errorsLast7Days', (
      select coalesce(json_agg(row_to_json(e)), '[]'::json) from (
        select job_name as "jobName", count(*)::int as count
        from cron_run_log
        where status = 'error' and origin = 'scheduled' and started_at >= now() - interval '7 days'
        group by job_name
      ) e
    )
  );
$$;
