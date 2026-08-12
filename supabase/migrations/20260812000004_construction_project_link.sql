-- Vincula la nómina de Declaración en Construcción de CNE con los proyectos.
--
-- `construction_project` existe desde 20260722000001 pero nunca tuvo forma de
-- apuntar a un proyecto, así que sus 193 filas sólo alimentaban agregados de
-- /mercado. Es la única fuente que entrega el **acto administrativo citable**
-- —número y fecha de resolución— detrás de "declarado en construcción": el
-- estado del Coordinador dice que ocurrió, la resolución de CNE dice cuál es.
--
-- Igual que en pertinencia_consulta, se guarda quién hizo el vínculo: un cruce
-- automático tiene que seguir siendo identificable y reversible por lote
-- después de escrito (ver 20260812000003 y lib/shared/seiaMatchTrust.ts).

alter table construction_project
  add column if not exists project_id uuid references project (id) on delete set null,
  add column if not exists match_score integer,
  add column if not exists match_confirmed_by text,
  add column if not exists match_confirmed_at timestamptz;

create index if not exists construction_project_project_idx
  on construction_project (project_id)
  where project_id is not null;

comment on column construction_project.match_confirmed_by is
  '"human" = vinculado a mano; "auto_<regla>" = cruce automático, revisable y reversible por lote.';
