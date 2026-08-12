-- PELP: Planificación Energética de Largo Plazo del Ministerio de Energía.
-- Modelo de expansión del SEN (PyPSA-CL), fuente https://energia.gob.cl/pelp/proyecciones-electricas
--
-- QUÉ ES Y QUÉ NO ES: estos registros son resultados de un modelo de
-- optimización, no proyectos. La propia fuente los agrupa bajo "2. [resultados]"
-- y marca los activos con `p_nom_extendable` / `candidate`, que en PyPSA
-- significa "candidato de expansión". Un nombre como "solar PV_Antofagasta_39"
-- es un identificador sintético tecnología_zona_índice, no una sociedad ni una
-- central. Por eso NO entran en `project`.
--
-- POR QUÉ TABLAS PROPIAS Y NO `project`: meterlos ahí obligaría a excluirlos en
-- cada consulta del dashboard, el mapa, el CRM y Transition AI, y el primer
-- olvido los mostraría como proyectos reales. Aislados, el riesgo de
-- contaminación cruzada es cero. El matching contra SEIA/Coordinador es un
-- proceso posterior y explícito, nunca automático.
--
-- RLS: se activa sin políticas de cliente. Las lecturas van por el servidor con
-- el cliente de servicio, igual que 20260806000000 hace con las tablas de sync.

create table if not exists pelp_extraction_run (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  model_version text,
  model_id bigint,
  dataset_id text,
  source_url text,
  rows_extracted integer,
  rows_inserted integer,
  rows_updated integer,
  error_message text
);

create table if not exists pelp_scenario (
  id uuid primary key default gen_random_uuid(),
  -- `scenario` es el código interno ("E2 - Exploratorio BAU") y `scenario_name`
  -- el rótulo que muestra la visualización ("E2 - Exploratorio tendencial").
  -- No coinciden: se guardan los dos.
  scenario_id text not null unique,
  scenario_name text not null,
  demand_scenario text,
  climate_scenario text,
  hydrology_scenario text,
  generation_investment_cost_scenario text,
  storage_investment_cost_scenario text,
  fuel_price_scenario text,
  raw_record jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists pelp_carrier (
  id uuid primary key default gen_random_uuid(),
  carrier text not null unique,
  carrier_name text,
  -- Normalización nuestra (solar_PV, onshore_wind, offshore_wind, BESS...).
  -- `carrier` conserva siempre el valor original de PELP.
  technology_code text,
  updated_at timestamptz not null default now()
);

create table if not exists pelp_node (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tension numeric,
  latitude numeric,
  longitude numeric,
  comuna text,
  provincia text,
  region text,
  raw_record jsonb,
  updated_at timestamptz not null default now()
);

-- Diccionario de activos de almacenamiento. Existe por una razón concreta:
-- `capacity_expansion_MWh` viene 100% nulo en la tabla de expansión, así que la
-- duración de las BESS solo puede salir de acá (`max_hours`, poblado en 244 de
-- 245 activos). Nunca se infiere.
create table if not exists pelp_storage_asset (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  node text,
  carrier text,
  p_nom numeric,
  max_hours numeric,
  efficiency_store numeric,
  efficiency_dispatch numeric,
  p_nom_extendable boolean,
  build_year integer,
  lifetime numeric,
  raw_record jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists pelp_expansion (
  id uuid primary key default gen_random_uuid(),

  -- Clave lógica de deduplicación. Verificada contra la extracción del
  -- 2026-08-12: 15.600 filas, ninguna colisión con esta combinación.
  scenario_id text not null,
  model_version text not null,
  asset_name_raw text not null,
  technology_raw text not null,
  node_raw text not null,
  year integer not null,

  -- Clasificación explícita para que ningún consumidor confunda estos registros
  -- con proyectos reales. Son constantes hoy, pero quedan como columnas para
  -- poder incorporar otras fuentes de modelamiento sin cambiar el esquema.
  source text not null default 'PELP',
  source_type text not null default 'PELP_MODEL',
  project_type text not null default 'MODELLED_EXPANSION',
  status text not null default 'MODELLED',

  asset_type text,
  technology_code text,
  capacity_expansion_mw numeric,
  capacity_expansion_cumulative_mw numeric,
  capacity_expansion_mwh numeric,
  capacity_expansion_cumulative_mwh numeric,
  duration_hours numeric,

  latitude numeric,
  longitude numeric,
  region_raw text,
  provincia_raw text,
  comuna_raw text,

  source_url text not null default 'https://energia.gob.cl/pelp/proyecciones-electricas',
  source_name text not null default 'Planificación Energética de Largo Plazo - Modelo de Expansión del SEN',
  retrieved_at timestamptz not null default now(),
  extraction_run_id uuid references pelp_extraction_run (id) on delete set null,
  raw_record jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pelp_expansion_logical_key
    unique (scenario_id, model_version, asset_name_raw, technology_raw, node_raw, year)
);

create index if not exists pelp_expansion_scenario_year_idx on pelp_expansion (scenario_id, year);
create index if not exists pelp_expansion_technology_idx on pelp_expansion (technology_code);
create index if not exists pelp_expansion_region_idx on pelp_expansion (region_raw);
create index if not exists pelp_expansion_comuna_idx on pelp_expansion (comuna_raw);
create index if not exists pelp_expansion_node_idx on pelp_expansion (node_raw);

alter table pelp_extraction_run enable row level security;
alter table pelp_scenario enable row level security;
alter table pelp_carrier enable row level security;
alter table pelp_node enable row level security;
alter table pelp_storage_asset enable row level security;
alter table pelp_expansion enable row level security;
