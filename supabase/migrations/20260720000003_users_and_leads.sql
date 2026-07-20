-- User profiles, behavior tracking, lead scoring.
-- Reference: /docs/07-inteligencia-leads.md §7.2, /docs/08-modelo-suscripciones.md §8.2

create table user_profile (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  company_name text,
  role text,
  country text,
  industry text,
  user_type text check (user_type in (
    'developer', 'investor', 'epc', 'technology_provider', 'supplier',
    'financial_institution', 'consultant', 'corporate', 'government', 'other'
  )),
  interests text[] not null default '{}',
  organization_id uuid references organization (id),
  plan_id uuid references plan (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table entitlement_override
  add constraint entitlement_override_user_profile_fk
  foreign key (user_profile_id) references user_profile (id) on delete cascade;

create table behavior_event (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references user_profile (id) on delete set null,
  session_id text,
  event_type text not null check (event_type in (
    'project_view', 'ai_query', 'filter_applied', 'report_generated', 'search'
  )),
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index behavior_event_user_idx on behavior_event (user_profile_id, occurred_at);
create index behavior_event_session_idx on behavior_event (session_id, occurred_at);

create table lead_score (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references user_profile (id) on delete cascade,
  engagement_score numeric not null default 0,
  intent_score numeric not null default 0,
  commercial_fit_score numeric not null default 0,
  market_fit_score numeric not null default 0,
  onix_opportunity_score numeric not null default 0,
  calculated_at timestamptz not null default now()
);
create index lead_score_user_idx on lead_score (user_profile_id, calculated_at);

create table lead (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references user_profile (id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'exported', 'working', 'won', 'lost')),
  onix_opportunity_score numeric not null,
  exported_at timestamptz,
  crm_reference_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lead_status_idx on lead (status);

create table opportunity (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project (id) on delete cascade,
  opportunity_type text, -- 'investment','epc','technology_sale','partnership','market_entry', ...
  description text,
  confidence_level text not null default 'INTELIGENCIA_DE_MERCADO'
    check (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO', 'INTELIGENCIA_DE_MERCADO', 'ESTIMADO')),
  created_at timestamptz not null default now()
);
create index opportunity_project_idx on opportunity (project_id);

create table market_signal (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  related_entity_type text,
  related_entity_id uuid,
  description text not null,
  data_source_id uuid references data_source (id),
  occurred_at timestamptz,
  created_at timestamptz not null default now()
);
