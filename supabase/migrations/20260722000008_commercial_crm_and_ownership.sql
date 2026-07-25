-- Capa interna comercial y de relaciones societarias.
-- Las participaciones solo se cargan desde fuentes identificadas; nunca se infieren.

alter table opportunity
  add column company_id uuid references company (id),
  add column person_id uuid references person (id),
  add column stage text not null default 'identificada'
    check (stage in ('identificada', 'investigando', 'contacto_pendiente', 'contactada', 'conversacion', 'propuesta', 'ganada', 'perdida')),
  add column owner_name text,
  add column next_step text,
  add column next_step_at date,
  add column last_contacted_at date,
  add column updated_at timestamptz not null default now();

create index opportunity_stage_idx on opportunity (stage, next_step_at);
create index opportunity_company_idx on opportunity (company_id);

create table company_shareholding (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company (id) on delete cascade,
  shareholder_company_id uuid references company (id) on delete cascade,
  shareholder_person_id uuid references person (id) on delete cascade,
  ownership_pct numeric check (ownership_pct >= 0 and ownership_pct <= 100),
  relationship_role text not null default 'accionista'
    check (relationship_role in ('accionista', 'inversionista', 'controlador', 'beneficiario_final')),
  valid_from date,
  valid_to date,
  data_source_id uuid references data_source (id),
  confidence_level text not null default 'PUBLICO'
    check (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO', 'INTELIGENCIA_DE_MERCADO', 'ESTIMADO')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(shareholder_company_id, shareholder_person_id) = 1)
);
create index company_shareholding_company_idx on company_shareholding (company_id);
create index company_shareholding_shareholder_company_idx on company_shareholding (shareholder_company_id);

alter table company_shareholding enable row level security;
-- Se aplica la misma regla temporal de datos de relación: lectura pública de fuentes verificadas/públicas.
create policy public_read on company_shareholding for select using (confidence_level in ('VERIFICADO', 'CONFIRMADO_POR_PROPIETARIO', 'PUBLICO'));

