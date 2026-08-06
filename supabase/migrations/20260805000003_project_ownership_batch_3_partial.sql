-- Third ownership batch (first two cases), supplied by ONIX.
insert into ownership_entity (legal_name, rut, entity_type, country_code) values
  ('Parque Eólico Antofagasta SpA', '76.188.406-9', 'company', 'CL'),
  ('Eólica de Taltal SpA', '77.244.405-2', 'company', 'CL'),
  ('Repsol Chile SpA', '96.720.750-0', 'company', 'CL'),
  ('Membrillo SpA', '76.882.328-6', 'company', 'CL'),
  ('Alhia SpA', '76.908.957-8', 'company', 'CL'),
  ('Langa Chile SpA', '76.596.592-6', 'company', 'CL')
on conflict do nothing;

with rel(owner_rut, owned_rut, pct) as (values
  ('967207500','772444052',100::numeric),
  ('772444052','761884069',100::numeric),
  ('765965926','769089578',100::numeric),
  ('769089578','768823286',100::numeric)
)
insert into ownership_relation (owner_entity_id, owned_entity_id, ownership_percent, source_label, source_date)
select owner.id, owned.id, rel.pct, 'Información societaria provista por ONIX', date '2026-08-04'
from rel
join ownership_entity owner on upper(regexp_replace(owner.rut, '[^0-9Kk]', '', 'g')) = rel.owner_rut
join ownership_entity owned on upper(regexp_replace(owned.rut, '[^0-9Kk]', '', 'g')) = rel.owned_rut
on conflict (owner_entity_id, owned_entity_id) do update
set ownership_percent = excluded.ownership_percent, updated_at = now();

with profiles(project_name, spv_rut) as (values
  ('Parque Eólico Antofagasta','761884069'),
  ('Parque FV Marte','768823286')
)
insert into project_ownership_profile (project_id, spv_entity_id, coverage_status, source_date)
select p.id, e.id, 'partial', date '2026-08-04'
from profiles
join project p on trim(p.name) = profiles.project_name and p.verified_at is not null
join ownership_entity e on upper(regexp_replace(e.rut, '[^0-9Kk]', '', 'g')) = profiles.spv_rut
on conflict (project_id) do update
set spv_entity_id = excluded.spv_entity_id,
    coverage_status = excluded.coverage_status,
    source_date = excluded.source_date,
    updated_at = now();

