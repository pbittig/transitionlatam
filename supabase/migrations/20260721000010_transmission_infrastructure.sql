-- Infraestructura de transmisión (líneas y subestaciones) — API SIPUB del
-- Coordinador Eléctrico Nacional (ver ADR-019, misma fuente que power_plant).
--
-- Líneas: /lineas-transmision/v4/findByDate — vigente, actualizado a diario.
-- No incluye largo en km ni geometría (no existe ese campo en ningún endpoint
-- de los 95 que expone la API) — el conteo/desglose por tensión sí es real.
--
-- Subestaciones: no existen como entidad propia en la API — se derivan
-- agrupando /transformadores-2d/v3/findAll por `nombre_subestacion` (el
-- endpoint de transformadores de 3 devanados documentado en la API devuelve
-- 404 real en el servidor, no es un error nuestro — se deja fuera).

create table transmission_line (
  id_linea integer primary key,
  nombre text not null,
  codigo_linea text,
  voltage_kv numeric, -- parseado del nombre (ej. "...220KV")
  owner_name text,
  coordinado_name text,
  synced_at timestamptz not null default now()
);
create index transmission_line_owner_idx on transmission_line (owner_name);
create index transmission_line_voltage_idx on transmission_line (voltage_kv);

create table substation (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_normalized text not null unique,
  owner_name text,
  transformer_count int not null default 0,
  total_capacity_mva numeric,
  voltage_levels text, -- ej. "230/23 kV" — niveles distintos observados, concatenados
  synced_at timestamptz not null default now()
);
create index substation_owner_idx on substation (owner_name);

alter table transmission_line enable row level security;
alter table substation enable row level security;
create policy transmission_line_public_read on transmission_line for select using (true);
create policy substation_public_read on substation for select using (true);

create or replace function get_transmission_stats()
returns json
language sql
stable
as $$
  select json_build_object(
    'totalLines', (select count(*) from transmission_line),
    'byVoltage', (
      select coalesce(json_agg(row_to_json(v)), '[]'::json) from (
        select coalesce(voltage_kv, 0) as "voltageKv", count(*)::int as count
        from transmission_line
        group by voltage_kv
        order by voltage_kv desc nulls last
      ) v
    ),
    'topLineOwners', (
      select coalesce(json_agg(row_to_json(o)), '[]'::json) from (
        select owner_name as owner, count(*)::int as count
        from transmission_line
        where owner_name is not null
        group by owner_name
        order by count(*) desc
        limit 10
      ) o
    ),
    'totalSubstations', (select count(*) from substation),
    'totalTransformerCapacityMva', (select coalesce(sum(total_capacity_mva), 0) from substation),
    'topSubstationOwners', (
      select coalesce(json_agg(row_to_json(o)), '[]'::json) from (
        select owner_name as owner, count(*)::int as count, coalesce(sum(total_capacity_mva), 0) as "capacityMva"
        from substation
        where owner_name is not null
        group by owner_name
        order by 3 desc
        limit 10
      ) o
    )
  );
$$;

grant execute on function get_transmission_stats() to anon, authenticated;
