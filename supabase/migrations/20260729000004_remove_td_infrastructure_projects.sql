-- El alcance editorial se limita a generación renovable y BESS. Estas palabras
-- identifican obras T&D puras y se eliminan de la cartera de proyectos.

delete from public.formulario_ingest_log
where project_id in (
  select id
  from public.project
  where unaccent(lower(name)) ~
    '\m(subestacion(es)?|linea(s)?|seccionador(es)?|seccionamiento(s)?|transformador(es)?)\M'
);

delete from public.project
where unaccent(lower(name)) ~
  '\m(subestacion(es)?|linea(s)?|seccionador(es)?|seccionamiento(s)?|transformador(es)?)\M';
