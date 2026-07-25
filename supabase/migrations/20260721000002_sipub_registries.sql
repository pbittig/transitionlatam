-- Registros oficiales del Coordinador Eléctrico Nacional vía API SIPUB (ADR-019).
-- Dos fuentes nuevas, independientes del pipeline de Acceso Abierto:
--   1. coordinador_empresa: espejo de /api/v2/recursos/infotecnica/empresas/, usado
--      para agrupar empresas relacionadas por el campo "grupo" (no hay RUT confiable
--      en esta fuente — el vínculo hacia `company` es por nombre normalizado, best-effort).
--   2. power_plant: espejo de /centrales/v4/findByDate — centrales YA operativas o en
--      construcción, capa separada de `project` (que es el pipeline de solicitudes en
--      desarrollo, no de activos instalados).

create table coordinador_empresa (
  id_infotecnica integer primary key,
  nombre text not null,
  name_normalized text not null,
  grupo integer,
  giro integer,
  mnemotecnico text,
  numero integer,
  descripcion text,
  is_hidden boolean not null default false, -- nombre trae sufijo [No_Mostrar]
  synced_at timestamptz not null default now()
);
create index coordinador_empresa_grupo_idx on coordinador_empresa (grupo);
create index coordinador_empresa_name_normalized_idx on coordinador_empresa (name_normalized);

create table power_plant (
  id_central integer primary key,
  name text not null,
  owner_name text,
  plant_type text, -- tipo_central: Solares, Eólicas, Hidroeléctricas, Termoeléctricas
  technology_detail text, -- tipo_tecnologia
  energy_conversion text, -- tipo_conv_energia
  is_renewable boolean, -- conv_ernc == 'ERNC'
  status text, -- estado
  installation_code text, -- instalacion
  connection_point text,
  gross_max_power_mw numeric,
  net_capacity_mw numeric,
  min_technical_power_mw numeric,
  own_consumption_mw numeric,
  unit_count integer,
  operation_start_date date,
  region text,
  provincia text,
  comuna text,
  utm_zone text,
  utm_east numeric,
  utm_north numeric,
  latitude double precision,
  longitude double precision,
  is_hidden boolean not null default false, -- nombre trae sufijo [NO_MOSTRAR]
  synced_at timestamptz not null default now()
);
create index power_plant_region_idx on power_plant (region);
create index power_plant_status_idx on power_plant (status);
create index power_plant_technology_idx on power_plant (technology_detail);

alter table coordinador_empresa enable row level security;
alter table power_plant enable row level security;

create policy coordinador_empresa_public_read on coordinador_empresa
  for select using (is_hidden = false);
create policy power_plant_public_read on power_plant
  for select using (is_hidden = false);

insert into data_source (name, source_type, base_url) values
  ('Coordinador Eléctrico Nacional - API SIPUB', 'public_portal', 'https://sipub.api.coordinador.cl');
