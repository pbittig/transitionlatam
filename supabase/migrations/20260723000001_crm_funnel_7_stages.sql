-- Reemplaza el funnel comercial genérico de 8 etapas por uno de 7 con
-- nombres propios del proceso de venta de ONIX (ver docs/superpowers/specs/
-- 2026-07-23-crm-opportunity-funnel-design.md). El constraint viejo se
-- suelta ANTES de remapear los datos — de lo contrario cualquier UPDATE
-- que de verdad afecte una fila queda rechazado por el CHECK viejo, que
-- todavía solo permite los 8 valores antiguos (hallazgo real de revisión:
-- esta migración corrió limpia en producción solo porque la tabla estaba
-- vacía en ese momento, no porque el orden fuera correcto).
alter table opportunity drop constraint opportunity_stage_check;

-- Remapeo por cercanía semántica — "propuesta" cae en "elaboracion_propuesta"
-- (la más conservadora) porque el dato viejo no distingue una propuesta en
-- elaboración de una ya enviada.
update opportunity set stage = 'contacto'
  where stage in ('identificada', 'investigando', 'contacto_pendiente', 'contactada');
update opportunity set stage = 'reunion' where stage = 'conversacion';
update opportunity set stage = 'elaboracion_propuesta' where stage = 'propuesta';
update opportunity set stage = 'cierre_ganado' where stage = 'ganada';
update opportunity set stage = 'cierre_perdido' where stage = 'perdida';

alter table opportunity alter column stage set default 'contacto';
alter table opportunity add constraint opportunity_stage_check
  check (stage in ('contacto', 'reunion', 'elaboracion_propuesta', 'envio_propuesta', 'seguimiento', 'cierre_ganado', 'cierre_perdido'));
