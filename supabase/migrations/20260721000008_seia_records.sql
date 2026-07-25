-- Nota: `seia_record` ya existía desde el esquema inicial (20260720000000,
-- Fase 0) con RLS+policy pública ya aplicadas (20260720000005). Este archivo
-- solo registra la nueva fuente en `data_source` — los campos adicionales
-- necesarios para el conector viven en 20260721000009_seia_record_search_fields.sql.

insert into data_source (name, source_type, base_url) values
  ('SEIA - Servicio de Evaluación Ambiental', 'public_portal', 'https://seia.sea.gob.cl');
