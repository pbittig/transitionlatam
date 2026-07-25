-- Reemplaza SIPUB (Coordinador) como fuente de capacidad instalada por CNE
-- (Comisión Nacional de Energía) — subestima la capacidad real en ~7.7%
-- (verificado: 35.829 MW SIPUB vs 38.608 MW CNE al 15/07/2026), sobre todo en
-- solar, eólica y térmica. CNE no tiene un ID numérico de central estable como
-- SIPUB (viene a nivel de unidad generadora, no de central) — se usa una clave
-- natural (sistema+nombre central) para poder actualizar sin duplicar filas.
alter table power_plant add column if not exists external_key text;
create unique index if not exists power_plant_external_key_idx on power_plant (external_key) where external_key is not null;

-- Registro de cada carga del archivo de CNE — permite detectar si el archivo
-- que el usuario descarga semanalmente realmente cambió (columna fecha_act
-- del CSV) antes de reprocesar todo.
create table if not exists cne_capacidad_sync_log (
  id uuid primary key default gen_random_uuid(),
  fecha_act date not null,
  row_count integer not null,
  total_capacity_mw numeric not null,
  synced_at timestamptz not null default now()
);

insert into data_source (name, source_type, base_url)
select 'CNE - Capacidad Instalada (Energía Abierta)', 'manual_entry', 'http://energiaabierta.cl/visualizaciones/capacidad-instalada/'
where not exists (select 1 from data_source where name = 'CNE - Capacidad Instalada (Energía Abierta)');
