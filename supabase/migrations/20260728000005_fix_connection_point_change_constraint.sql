-- 20260724000001_connection_point_change_event.sql quedó marcada como aplicada
-- en el tracker _migrations, pero el constraint vivo en Supabase nunca incluyó
-- 'connection_point_change' (causaba "violates check constraint
-- project_event_event_type_check" en cada sync de listado que detectaba un
-- cambio de punto de conexión). Re-aplica el mismo ALTER, idempotente.
alter table project_event drop constraint if exists project_event_event_type_check;
alter table project_event add constraint project_event_event_type_check
  check (event_type in (
    'announced', 'capacity_change', 'ownership_change', 'developer_change',
    'connection_date_change', 'construction_date_change', 'status_change',
    'seia_milestone', 'delay', 'other', 'connection_point_change'
  ));
