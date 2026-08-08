-- Agregación server-side para /admin/metricas. Mismo criterio que
-- get_dashboard_stats (20260721000000): PostgREST trunca en 1000 filas sin
-- avisar, así que sumar/agrupar behavior_event o user_profile en Node en vez
-- de SQL corre el riesgo de contar mal en silencio apenas la tabla crezca.

create or replace function get_admin_activity_metrics()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalUsers', (select count(*) from user_profile),
    'activeUsersLast7Days', (
      select count(distinct user_profile_id) from behavior_event
      where occurred_at >= now() - interval '7 days'
        and user_profile_id is not null
    ),
    'totalProjectViews', (
      select count(*) from behavior_event where event_type = 'project_view'
    ),
    'verifiedProjects', (select count(*) from project where verified_at is not null),
    'totalProjects', (select count(*) from project where editorial_status = 'published'),
    'signupsByDay', (
      select coalesce(json_agg(row_to_json(d) order by d.day), '[]'::json) from (
        select date_trunc('day', created_at)::date as day, count(*)::int as count
        from user_profile
        where created_at >= now() - interval '30 days'
        group by 1
      ) d
    ),
    'mostViewedProjects', (
      select coalesce(json_agg(row_to_json(p)), '[]'::json) from (
        select project.id, project.name, project.internal_code as "internalCode", count(*)::int as views
        from behavior_event
        join project on project.id = behavior_event.entity_id
        where behavior_event.event_type = 'project_view'
          and behavior_event.occurred_at >= now() - interval '90 days'
        group by project.id, project.name, project.internal_code
        order by count(*) desc
        limit 15
      ) p
    )
  );
$$;
