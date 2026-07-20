-- Core schema for Transition LATAM — MVP Chile.
-- Reference: /docs/04-modelo-datos.md

create extension if not exists pgcrypto;

-- ============================================================
-- Reference data
-- ============================================================

create table country (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- ISO 3166-1 alpha-2, e.g. 'CL'
  name text not null,
  created_at timestamptz not null default now()
);

create table region (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references country (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

create table location (
  id uuid primary key default gen_random_uuid(),
  region_id uuid references region (id),
  comuna text,
  address text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table technology (
  id uuid primary key default gen_random_uuid(),
  code text not null unique, -- 'solar_pv','wind','bess','hybrid','hydro','thermal', ...
  name text not null
);

create table data_source (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. 'Acceso Abierto - Coordinador Eléctrico Nacional', 'SEIA'
  source_type text not null check (source_type in ('public_portal', 'manual_entry', 'owner_confirmed', 'third_party', 'internal_analysis')),
  base_url text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Companies, SPVs, people
-- ============================================================

create table company (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  country_id uuid references country (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table entity_alias (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'spv', 'person', 'project')),
  entity_id uuid not null,
  alias text not null,
  created_at timestamptz not null default now()
);
create index entity_alias_lookup on entity_alias (entity_type, alias);

create table spv (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_company_id uuid references company (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table person (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Projects
-- ============================================================

create table project (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references country (id),
  name text not null,
  external_reference text, -- e.g. NUP (SEIA/CEN)
  technology_id uuid references technology (id),
  location_id uuid references location (id),
  spv_id uuid references spv (id),
  developer_company_id uuid references company (id),
  project_kind text check (project_kind in ('generation', 'storage', 'consumption', 'transmission', 'hybrid')),
  capacity_mw numeric,
  capacity_mwh numeric,
  status text,
  estimated_connection_date date,
  construction_start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_country_idx on project (country_id);
create index project_technology_idx on project (technology_id);
create index project_status_idx on project (status);
create index project_connection_date_idx on project (estimated_connection_date);

create table project_connection (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project (id) on delete cascade,
  request_type text, -- 'SAC' | 'SUCTD' | 'FEHACIENTE' | ...
  connection_point text,
  voltage_level text,
  substation_bay text, -- 'Paño'
  transmission_segment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_connection_project_idx on project_connection (project_id);

create table connection_status (
  code text primary key,
  label text not null,
  description text
);

create table seia_record (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references project (id) on delete cascade,
  seia_id text, -- identificador del expediente en SEIA
  submission_type text, -- DIA / EIA
  filing_reason text,
  titular_name text,
  investment_amount numeric,
  status text,
  filed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index seia_record_project_idx on seia_record (project_id);

-- ============================================================
-- Relationships (typed, generic — see docs §4.5)
-- ============================================================

create table entity_relationship (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  relationship_type text not null,
  target_type text not null,
  target_id uuid not null,
  valid_from date,
  valid_to date,
  data_source_id uuid references data_source (id),
  confidence_level text not null default 'PUBLICO'
    check (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO', 'INTELIGENCIA_DE_MERCADO', 'ESTIMADO')),
  created_at timestamptz not null default now()
);
create index entity_relationship_source_idx on entity_relationship (source_type, source_id);
create index entity_relationship_target_idx on entity_relationship (target_type, target_id);
