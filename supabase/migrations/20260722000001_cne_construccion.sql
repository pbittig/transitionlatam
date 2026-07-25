-- Proyectos "en construcción" según CNE (Declaración en Construcción, resolución
-- mensual) — reemplaza el conteo que antes venía de SIPUB (power_plant), que no
-- distinguía este estado de forma confiable. A diferencia de capacidad instalada,
-- este archivo SÍ incluye BESS (columna proyecto_bess_asociado / tipo_tecnologia).
-- Cada fila viene re-sellada con la resolución vigente (num_res/fecha_res) al
-- momento de la descarga — se usa como clave de versión para el chequeo periódico,
-- igual que fecha_act en cne_capacidad_sync_log.
create table if not exists construction_project (
  id uuid primary key default gen_random_uuid(),
  proyecto_central text not null,
  proyecto_bess_asociado text,
  propietario text,
  tipo_tecnologia text,
  tipo_tecnologia_final text,
  categoria text,
  potencia_neta_mw numeric,
  capacidad_instalada_raw text, -- texto libre en la fuente (a veces no es solo un número, ej. "3 MWp Solar + 1 MW,2,3 MWh Baterías")
  barra_conexion text,
  res_original text,
  fecha_original_interconexion date,
  fecha_estimada_interconexion date,
  region text,
  num_res text not null,
  fecha_res date not null,
  synced_at timestamptz not null default now()
);
create index if not exists construction_project_region_idx on construction_project (region);
create index if not exists construction_project_tecnologia_idx on construction_project (tipo_tecnologia_final);

create table if not exists cne_construccion_sync_log (
  id uuid primary key default gen_random_uuid(),
  num_res text not null,
  fecha_res date not null,
  row_count integer not null,
  total_potencia_mw numeric not null,
  synced_at timestamptz not null default now()
);

insert into data_source (name, source_type, base_url)
select 'CNE - Declaración en Construcción', 'manual_entry', 'https://www.cne.cl/tarificacion/electrica/declaracion-en-construccion/'
where not exists (select 1 from data_source where name = 'CNE - Declaración en Construcción');
