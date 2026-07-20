-- Subscription entitlements model.
-- Reference: /docs/08-modelo-suscripciones.md §8.2

create table plan (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('free', 'professional', 'business', 'enterprise')),
  name text not null,
  description text
);

create table feature (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'advanced_filters','ai_extended','opportunity_scoring', ...
  name text not null
);

create table plan_feature (
  plan_id uuid not null references plan (id) on delete cascade,
  feature_id uuid not null references feature (id) on delete cascade,
  limit_config jsonb not null default '{}'::jsonb,
  primary key (plan_id, feature_id)
);

create table organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_id uuid not null references plan (id),
  billing_status text not null default 'none' check (billing_status in ('none', 'trialing', 'active', 'past_due', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table entitlement_override (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid, -- FK added in 20260720000003 after user_profile exists
  organization_id uuid references organization (id),
  feature_id uuid not null references feature (id),
  limit_config jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_profile_id is not null or organization_id is not null)
);

insert into plan (code, name, description) values
  ('free', 'Free', 'Dashboard público, acceso básico a proyectos, Transition AI limitado'),
  ('professional', 'Professional', 'Filtros avanzados, IA ampliada, comparación de proyectos, reportes avanzados'),
  ('business', 'Business', 'Inteligencia avanzada, Opportunity Scoring, Company Intelligence'),
  ('enterprise', 'Enterprise', 'Dashboards personalizados, datasets personalizados, agentes IA personalizados');
