-- Second ownership batch supplied by ONIX for validated projects.
insert into ownership_entity (legal_name, rut, entity_type, country_code) values
  ('CMS SPVIII SpA', '77.249.632-K', 'company', 'CL'),
  ('Asesorías y Servicios CMS Energy Limitada', '77.178.104-7', 'company', 'CL'),
  ('Claudio Igor Montes Dessy', '8.936.616-K', 'person', 'CL'),
  ('Royal Thomas Smith', '14.518.587-4', 'person', 'CL'),
  ('Fernando Ariel Costa', '14.602.352-5', 'person', 'CL'),
  ('Leones Solar SpA', '77.465.585-9', 'company', 'CL'),
  ('Juan Guillermo Walker Mateljan', '10.929.059-9', 'person', 'CL'),
  ('Bridge Almacenamiento Uno SpA', '77.878.553-6', 'company', 'CL'),
  ('Eólica Tablaruca SpA', '76.134.528-1', 'company', 'CL'),
  ('Bridge Ventures Group SpA', '77.454.714-2', 'company', 'CL'),
  ('Soles del Norte SpA', '77.450.167-3', 'company', 'CL'),
  ('Inversiones Homonota SpA', '77.432.876-9', 'company', 'CL'),
  ('Inversiones Soho SpA', '77.428.192-4', 'company', 'CL'),
  ('Inversiones Pirehueico SpA', '77.428.196-7', 'company', 'CL'),
  ('Alejandro Pedro Peñaloza García', '9.446.900-7', 'person', 'CL'),
  ('Juan Ignacio Poch Piretta', '13.657.118-4', 'person', 'CL'),
  ('Pía Alejandra Fernández de la Fuente', '10.100.223-3', 'person', 'CL')
on conflict do nothing;

with rel(owner_rut, owned_rut, pct) as (values
  ('8936616K','771781047',33.3333::numeric),
  ('145185874','771781047',33.3333::numeric),
  ('146023525','771781047',33.3333::numeric),
  ('771781047','77249632K',100::numeric),
  ('109290599','774655859',100::numeric),
  ('774547142','761345281',100::numeric),
  ('761345281','778785536',100::numeric),
  ('94469007','774328769',100::numeric),
  ('136571184','774281924',100::numeric),
  ('101002233','774281967',100::numeric),
  ('774328769','774501673',25::numeric),
  ('774281924','774501673',50::numeric),
  ('774281967','774501673',25::numeric)
)
insert into ownership_relation (owner_entity_id, owned_entity_id, ownership_percent, source_label, source_date)
select owner.id, owned.id, rel.pct, 'Información societaria provista por ONIX', date '2026-08-04'
from rel
join ownership_entity owner on upper(regexp_replace(owner.rut, '[^0-9Kk]', '', 'g')) = rel.owner_rut
join ownership_entity owned on upper(regexp_replace(owned.rut, '[^0-9Kk]', '', 'g')) = rel.owned_rut
on conflict (owner_entity_id, owned_entity_id) do update
set ownership_percent = excluded.ownership_percent, updated_at = now();

with profiles(project_name, spv_rut, coverage) as (values
  ('PFV Los Llanos','77249632K','complete'),
  ('Longos Solar','774655859','complete'),
  ('BESS Río Llanco (ex BESS Nueva Ancud)','778785536','partial'),
  ('Parque Solar Soles del Norte (ex Parque Solar Don Goyo)','774501673','complete')
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

