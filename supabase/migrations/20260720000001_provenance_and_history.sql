-- Data provenance/confidence and project history.
-- Reference: /docs/04-modelo-datos.md §4.3, §4.4

create table data_attribution (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  value jsonb not null,
  data_source_id uuid references data_source (id),
  source_date date,
  collected_at timestamptz not null default now(),
  confidence_level text not null
    check (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO', 'INTELIGENCIA_DE_MERCADO', 'ESTIMADO')),
  verification_status text not null default 'unverified'
    check (verification_status in ('verified', 'unverified', 'disputed', 'outdated')),
  is_current boolean not null default true
);
create index data_attribution_entity_idx on data_attribution (entity_type, entity_id, field_name);

create table project_event (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'announced', 'capacity_change', 'ownership_change', 'developer_change',
      'connection_date_change', 'construction_date_change', 'status_change',
      'seia_milestone', 'delay', 'other'
    )),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  previous_value jsonb,
  new_value jsonb,
  data_source_id uuid references data_source (id),
  confidence_level text not null default 'PUBLICO'
    check (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO', 'INTELIGENCIA_DE_MERCADO', 'ESTIMADO')),
  description text
);
create index project_event_project_idx on project_event (project_id, occurred_at);
create index project_event_type_idx on project_event (event_type);
