-- Reemplaza el funnel comercial genérico de 8 etapas por uno de 7 con
-- nombres propios del proceso de venta de ONIX (ver docs/superpowers/specs/
-- 2026-07-23-crm-opportunity-funnel-design.md). Remapea las filas existentes
-- por cercanía semántica antes de aplicar el nuevo CHECK — "propuesta" cae en
-- "elaboracion_propuesta" (la más conservadora) porque el dato viejo no
-- distingue una propuesta en elaboración de una ya enviada.
update opportunity set stage = 'contacto'
  where stage in ('identificada', 'investigando', 'contacto_pendiente', 'contactada');
update opportunity set stage = 'reunion' where stage = 'conversacion';
update opportunity set stage = 'elaboracion_propuesta' where stage = 'propuesta';
update opportunity set stage = 'cierre_ganado' where stage = 'ganada';
update opportunity set stage = 'cierre_perdido' where stage = 'perdida';

alter table opportunity drop constraint opportunity_stage_check;
alter table opportunity alter column stage set default 'contacto';
alter table opportunity add constraint opportunity_stage_check
  check (stage in ('contacto', 'reunion', 'elaboracion_propuesta', 'envio_propuesta', 'seguimiento', 'cierre_ganado', 'cierre_perdido'));
