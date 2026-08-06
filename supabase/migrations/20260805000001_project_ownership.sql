-- Structured ownership maps for verified projects. These tables are intentionally
-- service-role only: the server decides whether a Free or Prime user may see the
-- underlying entities and relationships.

create table if not exists ownership_entity (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  rut text,
  entity_type text not null check (entity_type in ('company', 'person', 'foreign_company')),
  country_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ownership_entity_rut_unique
  on ownership_entity ((upper(regexp_replace(rut, '[^0-9Kk]', '', 'g'))))
  where rut is not null;

create table if not exists ownership_relation (
  id uuid primary key default gen_random_uuid(),
  owner_entity_id uuid not null references ownership_entity(id) on delete cascade,
  owned_entity_id uuid not null references ownership_entity(id) on delete cascade,
  ownership_percent numeric(7,4) not null check (ownership_percent > 0 and ownership_percent <= 100),
  source_label text,
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_entity_id, owned_entity_id)
);

create table if not exists project_ownership_profile (
  project_id uuid primary key references project(id) on delete cascade,
  spv_entity_id uuid not null references ownership_entity(id),
  coverage_status text not null default 'complete' check (coverage_status in ('complete', 'partial')),
  source_label text not null default 'Información societaria provista por ONIX',
  source_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ownership_entity enable row level security;
alter table ownership_relation enable row level security;
alter table project_ownership_profile enable row level security;

-- Seed the first maps supplied for the validated pilot projects.
insert into ownership_entity (legal_name, rut, entity_type, country_code) values
  ('BESS Pueblo Hundido SpA', '77.748.009-K', 'company', 'CL'),
  ('Flexen Chile SpA', '77.275.115-K', 'company', 'CL'),
  ('Flexen S.A.', '59.307.620-2', 'foreign_company', null),
  ('Eléctrica Las Frutillas SpA', '77.642.885-K', 'company', 'CL'),
  ('Solek Chile Services SpA', '76.411.169-9', 'company', 'CL'),
  ('Solek Czech Services s.r.o.', '59.205.980-0', 'foreign_company', 'CZ'),
  ('La Serena Ocho SpA', '76.866.061-1', 'company', 'CL'),
  ('CCE ProCo Dos CHL SpA', '77.498.373-2', 'company', 'CL'),
  ('CCE MidCo Dos CHL SpA', '77.490.261-9', 'company', 'CL'),
  ('CCE TopCo2 CHL GmbH', '59.309.520-7', 'foreign_company', null),
  ('SCL III SpA', '77.244.808-2', 'company', 'CL'),
  ('SCL I SpA', '77.244.775-2', 'company', 'CL'),
  ('Enfragen Solar Spain S.A.', '59.288.130-6', 'foreign_company', 'ES'),
  ('La Piedra BESS SpA', '77.978.953-5', 'company', 'CL'),
  ('CP BESS I SpA', '77.978.218-2', 'company', 'CL'),
  ('Cool Power SpA', '76.967.993-6', 'company', 'CL'),
  ('Prisma Energía Renovable SpA', '76.939.483-4', 'company', 'CL'),
  ('Ingeniería Francisco Tomás Sáez Correa E.I.R.L.', '77.075.981-1', 'company', 'CL'),
  ('Ingeniería Inpower SpA', '76.695.696-3', 'company', 'CL'),
  ('Sergio Javier San Martín Contreras', '15.922.852-2', 'person', 'CL'),
  ('Circinus SpA', '77.504.395-4', 'company', 'CL'),
  ('Inversiones Balthazar Limitada', '76.284.290-4', 'company', 'CL'),
  ('Olivier Regis Potart', '21.566.081-8', 'person', 'CL'),
  ('Ana Ibáñez González', '21.570.635-4', 'person', 'CL')
on conflict do nothing;

with rel(owner_rut, owned_rut, pct) as (values
  ('593076202','77275115K',100::numeric), ('77275115K','77748009K',100::numeric),
  ('592059800','764111699',100::numeric), ('764111699','77642885K',100::numeric),
  ('593095207','774902619',100::numeric), ('774902619','774983732',100::numeric), ('774983732','768660611',100::numeric),
  ('592881306','772447752',100::numeric), ('772447752','772448082',100::numeric),
  ('770759811','769679936',50::numeric), ('766956963','769679936',50::numeric),
  ('159228522','769394834',100::numeric), ('769679936','779782182',94::numeric),
  ('769394834','779782182',6::numeric), ('779782182','779789535',100::numeric),
  ('215660818','762842904',50::numeric), ('215706354','762842904',50::numeric),
  ('762842904','775043954',100::numeric)
)
insert into ownership_relation (owner_entity_id, owned_entity_id, ownership_percent, source_label, source_date)
select owner.id, owned.id, rel.pct, 'Información societaria provista por ONIX', date '2026-08-04'
from rel
join ownership_entity owner on upper(regexp_replace(owner.rut, '[^0-9Kk]', '', 'g')) = rel.owner_rut
join ownership_entity owned on upper(regexp_replace(owned.rut, '[^0-9Kk]', '', 'g')) = rel.owned_rut
on conflict (owner_entity_id, owned_entity_id) do update
set ownership_percent = excluded.ownership_percent, updated_at = now();

with profiles(project_name, spv_rut, coverage) as (values
  ('BESS Pueblo Hundido','77748009K','complete'),
  ('Parque Solar Las Frutillas','77642885K','complete'),
  ('Habilitación de Retiro desde la Red CRCA Los Rastrojos.','768660611','complete'),
  ('LightHouse I','772448082','complete'),
  ('CP_SAE_100 (ex LA PIEDRA BESS)','779789535','partial'),
  ('BESS Picaflor Azul','775043954','complete')
)
insert into project_ownership_profile (project_id, spv_entity_id, coverage_status, source_date)
select p.id, e.id, profiles.coverage, date '2026-08-04'
from profiles
join project p on trim(p.name) = profiles.project_name and p.verified_at is not null
join ownership_entity e on upper(regexp_replace(e.rut, '[^0-9Kk]', '', 'g')) = profiles.spv_rut
on conflict (project_id) do update
set spv_entity_id = excluded.spv_entity_id,
    coverage_status = excluded.coverage_status,
    source_date = excluded.source_date,
    updated_at = now();

