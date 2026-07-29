-- Los sistemas de impulsión de agua son infraestructura de consumo/proceso y
-- quedan fuera del alcance de generación renovable y almacenamiento BESS.

delete from public.formulario_ingest_log
where project_id in (
  select id
  from public.project
  where unaccent(lower(name)) ~ '\mimpulsion(es)?\M'
);

delete from public.project
where unaccent(lower(name)) ~ '\mimpulsion(es)?\M';
