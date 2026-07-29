-- Flujo editorial: detectar -> prefiltrar -> pre-verificar -> verificar -> publicar.
-- Los proyectos existentes permanecen publicados; las nuevas ingestas nacen pendientes.
alter table project
  add column if not exists editorial_status text not null default 'published'
    check (editorial_status in ('pending', 'published', 'excluded')),
  add column if not exists detected_at timestamptz,
  add column if not exists prefilter_status text
    check (prefilter_status in ('candidate', 'review', 'out_of_scope')),
  add column if not exists prefilter_category text
    check (prefilter_category in ('renewable', 'bess', 'data_center', 'uncertain', 'out_of_scope')),
  add column if not exists prefilter_reason text,
  add column if not exists editorial_reviewed_at timestamptz,
  add column if not exists published_at timestamptz;

update project
set
  detected_at = coalesce(detected_at, created_at),
  published_at = coalesce(published_at, created_at)
where editorial_status = 'published';

-- Primera adopción: la última tanda detectada hoy pasa a la bandeja en vez de
-- quedar publicada sin revisión. Las filas históricas anteriores se preservan.
with latest_daily_batch as (
  select distinct pe.project_id
  from project_event pe
  where pe.event_type = 'announced'
    and pe.recorded_at >= date_trunc('day', now())
)
update project p
set
  editorial_status = 'pending',
  detected_at = coalesce((
    select max(pe.recorded_at)
    from project_event pe
    where pe.project_id = p.id and pe.event_type = 'announced'
  ), p.created_at),
  published_at = null,
  prefilter_status = case
    when p.includes_storage or (select code from technology where id = p.technology_id) = 'bess'
      or p.name ~* '(bess|bater[ií]a|almacenamiento|storage)' then 'candidate'
    when p.name ~* '(data[[:space:]]*cent(er|re)|datacenter|centro de datos|dc santiago|odata|ascenty|scala)' then 'candidate'
    when (select code from technology where id = p.technology_id) in ('solar_pv','wind','hydro','pumped_hydro','biomass','geothermal','hybrid') then 'candidate'
    when p.project_kind = 'generation' or (p.project_kind is null and p.technology_id is null) then 'review'
    else 'out_of_scope'
  end,
  prefilter_category = case
    when p.includes_storage or (select code from technology where id = p.technology_id) = 'bess'
      or p.name ~* '(bess|bater[ií]a|almacenamiento|storage)' then 'bess'
    when p.name ~* '(data[[:space:]]*cent(er|re)|datacenter|centro de datos|dc santiago|odata|ascenty|scala)' then 'data_center'
    when (select code from technology where id = p.technology_id) in ('solar_pv','wind','hydro','pumped_hydro','biomass','geothermal','hybrid') then 'renewable'
    when p.project_kind = 'generation' or (p.project_kind is null and p.technology_id is null) then 'uncertain'
    else 'out_of_scope'
  end,
  prefilter_reason = case
    when p.includes_storage or (select code from technology where id = p.technology_id) = 'bess'
      or p.name ~* '(bess|bater[ií]a|almacenamiento|storage)' then 'Tecnología o nombre asociado a almacenamiento/BESS.'
    when p.name ~* '(data[[:space:]]*cent(er|re)|datacenter|centro de datos|dc santiago|odata|ascenty|scala)' then 'Nombre asociado a infraestructura de data center.'
    when (select code from technology where id = p.technology_id) in ('solar_pv','wind','hydro','pumped_hydro','biomass','geothermal','hybrid') then 'Tecnología renovable identificada.'
    when p.project_kind = 'generation' or (p.project_kind is null and p.technology_id is null) then 'Tipo o tecnología incierta; requiere revisión humana.'
    else 'No corresponde a renovables, BESS ni data center según los datos disponibles.'
  end
from latest_daily_batch b
where p.id = b.project_id;

create index if not exists project_editorial_queue_idx
  on project (editorial_status, detected_at desc);
create index if not exists project_prefilter_queue_idx
  on project (prefilter_status, detected_at desc);

-- Los clientes anon/authenticated solo pueden leer proyectos aprobados.
-- service_role (ingesta, IA y Admin) continúa saltándose RLS.
drop policy if exists public_read on project;
create policy public_read_published on project
  for select
  using (editorial_status = 'published');
