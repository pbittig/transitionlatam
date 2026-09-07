-- El porcentaje de participación pasa a ser opcional.
--
-- Al incorporar las relaciones societarias de registros públicos (SII, CMF,
-- Diario Oficial) aparece un caso que el esquema original no admitía: aristas
-- de propiedad reales, con dueño y fuente identificados, que la fuente publica
-- SIN el porcentaje — típicamente las que vienen del Diario Oficial.
--
-- Exigir el porcentaje obligaba a descartar esas relaciones enteras, es decir a
-- perder el dato de quién es dueño de qué por no tener un dato secundario. Se
-- prefiere registrar la relación con el porcentaje en null: la ficha ya sabe
-- dibujar el conector sin la etiqueta, y "sin información" es preferible a
-- omitir el vínculo (docs/02-prd.md §2.3).
--
-- El check se mantiene para los valores presentes: si viene un porcentaje,
-- sigue teniendo que ser mayor que 0 y hasta 100.

alter table ownership_relation
  alter column ownership_percent drop not null;

alter table ownership_relation
  drop constraint if exists ownership_relation_ownership_percent_check;

alter table ownership_relation
  add constraint ownership_relation_ownership_percent_check
  check (ownership_percent is null or (ownership_percent > 0 and ownership_percent <= 100));

comment on column ownership_relation.ownership_percent is
  'Participación en la sociedad poseída. Null cuando la fuente identifica la relación pero no publica el porcentaje.';
