-- get_admin_operational_metrics (20260808000001) aliased cron_run_log columns
-- with row_to_json(j) as-is, so latestRunPerJob/errorsLast7Days came back
-- snake_case (started_at, job_name...) while lib/data-access/
-- adminOperationalMetrics.ts expects camelCase — a blind `as` cast hid this
-- at compile time, so every card rendered "NaN d · NaN s" and every job
-- showed the same error count (all keyed off the same `undefined`).
-- Real bug (2026-08-08), caught by screenshotting the page, not by typecheck.

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
        order by job_name, started_at desc
      ) j
    ),
    'errorsLast7Days', (
      select coalesce(json_agg(row_to_json(e)), '[]'::json) from (
        select job_name as "jobName", count(*)::int as count
        from cron_run_log
        where status = 'error' and started_at >= now() - interval '7 days'
        group by job_name
      ) e
    )
  );
$$;
