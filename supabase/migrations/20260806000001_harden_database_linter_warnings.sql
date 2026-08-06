-- Reduce Supabase Database Linter warnings without changing the public API.

-- Pin function object resolution. Public remains first because these functions
-- intentionally query public application tables; extensions is available for
-- helpers such as unaccent if the extension is relocated in a later migration.
create schema if not exists extensions;

alter function public.get_power_plant_stats()
  set search_path = public, extensions;
alter function public.get_map_region_bubbles(text[])
  set search_path = public, extensions;
alter function public.get_pipeline_funnel()
  set search_path = public, extensions;
alter function public.get_dashboard_stats()
  set search_path = public, extensions;
alter function public.get_power_plant_region_bubbles()
  set search_path = public, extensions;
alter function public.get_transmission_stats()
  set search_path = public, extensions;
alter function public.get_connection_calendar(integer)
  set search_path = public, extensions;
alter function public.get_request_age_benchmarks()
  set search_path = public, extensions;
alter function public.get_pipeline_scope_totals()
  set search_path = public, extensions;
alter function public.remove_terminal_project_from_following()
  set search_path = public, extensions;

-- This trigger function is invoked by PostgreSQL, never directly by clients.
revoke execute on function public.assign_profile_organization()
  from public, anon, authenticated;

-- This SECURITY DEFINER helper is intentionally callable by authenticated users
-- because organization RLS policies depend on it. Anonymous access is unnecessary.
revoke execute on function public.current_user_organization_id()
  from public, anon;
grant execute on function public.current_user_organization_id()
  to authenticated, service_role;

-- The bucket itself is public, so public object URLs continue to work without a
-- SELECT policy that also permits anonymous enumeration of every stored avatar.
drop policy if exists avatars_public_read on storage.objects;
