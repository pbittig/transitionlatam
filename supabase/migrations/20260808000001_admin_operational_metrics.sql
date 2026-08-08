-- Agregación server-side para /admin/operacion. Mismo criterio que
-- get_dashboard_stats / get_admin_activity_metrics: la agregación vive en
-- SQL, no en Node, para no depender del límite de 1000 filas de PostgREST.

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
      select coalesce(json_agg(row_to_json(j) order by j.job_name), '[]'::json) from (
        select distinct on (job_name)
          job_name, status, started_at, finished_at, duration_ms, error_message
        from cron_run_log
        order by job_name, started_at desc
      ) j
    ),
    'errorsLast7Days', (
      select coalesce(json_agg(row_to_json(e)), '[]'::json) from (
        select job_name, count(*)::int as count
        from cron_run_log
        where status = 'error' and started_at >= now() - interval '7 days'
        group by job_name
      ) e
    )
  );
$$;
