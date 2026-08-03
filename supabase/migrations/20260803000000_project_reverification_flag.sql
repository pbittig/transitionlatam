-- Proyectos ya verificados a mano cuyo estado/fecha cambió de forma sospechosa
-- (ej. retrocedió de madurez, o pasó a rechazado/desistido) en una corrida
-- posterior del sync. El sync sigue actualizando estado/fecha en proyectos
-- verificados (ver load.ts), pero ahora deja marca para revisión humana en vez
-- de sobrescribir en silencio.
alter table project
  add column needs_reverification boolean not null default false,
  add column reverification_reason text;

create index project_needs_reverification_idx on project (needs_reverification) where needs_reverification;
