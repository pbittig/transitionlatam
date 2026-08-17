-- Que el RUT sea único de verdad, no según cómo se escribió.
--
-- QUÉ PASABA: `company_rut_unique_idx` comparaba el texto crudo, y el mismo RUT
-- convivía en tres formatos —"77.177.065-7", "77177065-7", "771770657"— así que
-- los duplicados se le escapaban por el formato. Al 2026-08-16 había 51 grupos
-- de empresas compartiendo RUT, 52 filas de más, incluida una con tres
-- (JINKO POWER CHILE SPA, III y IV). El admin que escribía un RUT ya existente
-- se llevaba el error crudo del motor.
--
-- ORDEN OBLIGATORIO: esto va DESPUÉS de `scripts/merge-companies-by-rut.ts`.
-- Aplicado antes, el índice normalizado rechaza las 52 filas duplicadas que ya
-- existen y la migración falla entera. La fusión se corrió el 2026-08-16 y dejó
-- 0 grupos compartiendo RUT.
--
-- El UPDATE uniforma el formato de las que quedaron fuera de la fusión: 34
-- empresas que nunca estuvieron duplicadas y que el script no tocó, más algunas
-- con basura de la fuente ("76.254.033 - 9", con espacios). No cambia a quién
-- identifica cada fila; deja la columna pareja para leerla y compararla.
--
-- La expresión del índice es la misma que usa `normalizeRutDigits` en el
-- código (lib/ingestion/sources/sea-pertinencia/matching.ts). Si alguna de las
-- dos cambia, hay que cambiar la otra: una base que acepta lo que la aplicación
-- considera duplicado es peor que no tener índice.

-- Formato canónico "12.345.678-9". El dígito verificador puede ser K.
update company
set rut = regexp_replace(
      left(upper(regexp_replace(rut, '[^0-9kK]', '', 'g')), -1),
      '(\d)(?=(\d{3})+$)', '\1.', 'g'
    ) || '-' || right(upper(regexp_replace(rut, '[^0-9kK]', '', 'g')), 1)
where rut is not null
  and length(regexp_replace(rut, '[^0-9kK]', '', 'g')) >= 2
  and rut is distinct from (
    regexp_replace(
      left(upper(regexp_replace(rut, '[^0-9kK]', '', 'g')), -1),
      '(\d)(?=(\d{3})+$)', '\1.', 'g'
    ) || '-' || right(upper(regexp_replace(rut, '[^0-9kK]', '', 'g')), 1)
  );

drop index if exists company_rut_unique_idx;

create unique index company_rut_normalized_unique_idx
  on company (upper(regexp_replace(rut, '[^0-9kK]', '', 'g')))
  where rut is not null;
