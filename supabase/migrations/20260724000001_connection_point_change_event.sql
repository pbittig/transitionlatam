-- Add connection_point_change event type to project_event
alter table project_event drop constraint if exists project_event_event_type_check;
alter table project_event add constraint project_event_event_type_check
  check (event_type in (
    'announced', 'capacity_change', 'ownership_change', 'developer_change',
    'connection_date_change', 'construction_date_change', 'status_change',
    'seia_milestone', 'delay', 'other', 'connection_point_change'
  ));
