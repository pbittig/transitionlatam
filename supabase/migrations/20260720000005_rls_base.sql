-- Base RLS policies.
-- Reference: /docs/09-seguridad.md §9.2-9.3. service_role bypasses RLS by default in Supabase
-- and is the role used by ingestion jobs and admin operations — only anon/authenticated
-- policies are defined here.

-- ============================================================
-- Public market/reference data — read-only for anon + authenticated
-- ============================================================

alter table country enable row level security;
alter table region enable row level security;
alter table location enable row level security;
alter table technology enable row level security;
alter table connection_status enable row level security;
alter table company enable row level security;
alter table spv enable row level security;
alter table project enable row level security;
alter table project_connection enable row level security;
alter table seia_record enable row level security;
alter table project_event enable row level security;
alter table entity_relationship enable row level security;
alter table entity_alias enable row level security;
alter table data_source enable row level security;
alter table opportunity enable row level security;
alter table market_signal enable row level security;
alter table plan enable row level security;
alter table feature enable row level security;
alter table plan_feature enable row level security;

create policy public_read on country for select using (true);
create policy public_read on region for select using (true);
create policy public_read on location for select using (true);
create policy public_read on technology for select using (true);
create policy public_read on connection_status for select using (true);
create policy public_read on company for select using (true);
create policy public_read on spv for select using (true);
create policy public_read on project for select using (true);
create policy public_read on project_connection for select using (true);
create policy public_read on seia_record for select using (true);
create policy public_read on project_event for select using (true);
create policy public_read on entity_relationship for select using (true);
create policy public_read on entity_alias for select using (true);
create policy public_read on data_source for select using (true);
create policy public_read on opportunity for select using (true);
create policy public_read on market_signal for select using (true);
create policy public_read on plan for select using (true);
create policy public_read on feature for select using (true);
create policy public_read on plan_feature for select using (true);

-- No insert/update/delete policies for anon/authenticated on the tables above:
-- writes only happen via ingestion jobs and admin tooling using the service_role key,
-- which bypasses RLS.

-- ============================================================
-- Personal/contact data (person) and its provenance — authenticated only.
-- Field-level restriction by subscription plan happens in the API layer
-- (see /docs/08-modelo-suscripciones.md §8.4), not here — RLS only gates
-- "logged in at all" vs. fully anonymous access to contact data.
-- ============================================================

alter table person enable row level security;
create policy authenticated_read on person for select using (auth.role() = 'authenticated');

alter table data_attribution enable row level security;
create policy public_read_non_person on data_attribution
  for select
  using (entity_type <> 'person');
create policy authenticated_read_all on data_attribution
  for select
  using (auth.role() = 'authenticated');

-- ============================================================
-- User-owned data
-- ============================================================

alter table user_profile enable row level security;
create policy own_profile_select on user_profile
  for select using (auth.uid() = auth_user_id);
create policy own_profile_update on user_profile
  for update using (auth.uid() = auth_user_id);

alter table organization enable row level security;
create policy own_organization_select on organization
  for select using (
    id in (select organization_id from user_profile where auth_user_id = auth.uid())
  );

alter table behavior_event enable row level security;
create policy own_behavior_select on behavior_event
  for select using (
    user_profile_id in (select id from user_profile where auth_user_id = auth.uid())
  );
create policy own_behavior_insert on behavior_event
  for insert with check (
    user_profile_id in (select id from user_profile where auth_user_id = auth.uid())
  );

alter table lead_score enable row level security;
create policy own_lead_score_select on lead_score
  for select using (
    user_profile_id in (select id from user_profile where auth_user_id = auth.uid())
  );

alter table lead enable row level security;
create policy own_lead_select on lead
  for select using (
    user_profile_id in (select id from user_profile where auth_user_id = auth.uid())
  );

alter table entitlement_override enable row level security;
create policy own_entitlement_override_select on entitlement_override
  for select using (
    user_profile_id in (select id from user_profile where auth_user_id = auth.uid())
    or organization_id in (select organization_id from user_profile where auth_user_id = auth.uid())
  );
