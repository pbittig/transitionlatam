-- Quién confirmó el vínculo pertinencia ↔ proyecto.
--
-- Hasta ahora `match_status='confirmed'` no distinguía entre una persona que
-- revisó el expediente en /admin/pertinencias y un cruce automático. Esa
-- distinción importa: en agosto de 2026 se encontraron 32 expedientes SEIA
-- ajenos colgados de proyectos por un matcher automático cuyo resultado nadie
-- podía identificar como automático después (ver lib/shared/seiaMatchTrust.ts).
-- Sin esta columna, el mismo error sería igual de invisible acá.
--
-- Permite además revertir exactamente un lote automático sin tocar lo que
-- confirmó una persona:
--   update pertinencia_consulta set match_status='pending', matched_project_id=null
--   where match_confirmed_by = 'auto_name_region_comuna';

alter table pertinencia_consulta
  add column if not exists match_confirmed_by text,
  add column if not exists match_confirmed_at timestamptz;

comment on column pertinencia_consulta.match_confirmed_by is
  'null = confirmado por una persona antes de que existiera esta columna; "human" = confirmado en el verificador; "auto_<regla>" = cruce automático, revisable y reversible por lote.';

-- Las 8 confirmaciones que ya existían son humanas: quedan marcadas como tales
-- para que un lote automático nunca se confunda con ellas.
update pertinencia_consulta
set match_confirmed_by = 'human'
where match_status = 'confirmed' and match_confirmed_by is null;

create index if not exists pertinencia_consulta_confirmed_by_idx
  on pertinencia_consulta (match_confirmed_by)
  where match_confirmed_by is not null;
