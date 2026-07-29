-- Los alimentadores son infraestructura de distribución, no proyectos de
-- generación renovable ni almacenamiento BESS. Se eliminan de la cartera y se
-- deja la clasificación preventiva en el pre-filtro de ingesta.

delete from public.formulario_ingest_log
where project_id in (
  select id
  from public.project
  where name ~* '\malimentador(es)?\M'
);

delete from public.project
where name ~* '\malimentador(es)?\M';
