-- Desglose granular de potencia/energía por tipo de solicitud.
-- Reference: /docs/04-modelo-datos.md §4.8 — "Capacidad [MW]" solo no alcanza para
-- distinguir consumo (retiro) de generación (inyección) de almacenamiento (BESS).

alter table project
  add column net_injection_mw numeric,      -- Potencia Neta Solicitada de Inyección — generación/renovables
  add column net_withdrawal_mw numeric,      -- Potencia Neta Solicitada de Retiro — consumo
  add column generation_capacity_mw numeric, -- Potencia de Generación (nameplate)
  add column storage_capacity_mw numeric,    -- Potencia de Almacenamiento (BESS, nameplate)
  add column storage_hours numeric;          -- Horas de Almacenamiento (BESS)

comment on column project.capacity_mw is
  'Capacidad "titular" calculada según project_kind: retiro neto en consumo, '
  'almacenamiento en storage, inyección neta (o generación) en generación/híbrido. '
  'Ver columnas net_injection_mw/net_withdrawal_mw/generation_capacity_mw/storage_capacity_mw '
  'para el desglose completo sin pérdida de información.';
comment on column project.capacity_mwh is 'Energía de almacenamiento (BESS) — columna "Energia [MWh]" de la fuente.';
