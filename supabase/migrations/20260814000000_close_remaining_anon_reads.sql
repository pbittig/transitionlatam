-- Las dos tablas que se le escaparon a 20260812000005.
--
-- Esa migración se armó listando las policies con `roles = '{public}'`, que es
-- como quedan las que no declaran rol. Estas dos, creadas por
-- `20260806000000_secure_public_tables_rls.sql`, nombran `to anon,
-- authenticated` explícitamente — así que no salieron en esa lista y siguieron
-- contestándole a cualquiera con la anon key: construction_project (193 filas,
-- 21 columnas) y cne_capacidad_sync_log.
--
-- LO QUE ENSEÑA: para saber quién puede leer una tabla no alcanza con filtrar
-- por `roles = '{public}'`. Hay dos formas de escribir lo mismo y solo una cae
-- en ese filtro. La consulta correcta es la que pregunta por el efecto —
-- `scripts/check-anon-access.ts`, que intenta el select con la anon key de
-- verdad— y fue justamente la que encontró estas dos después de aplicar la
-- migración anterior.
--
-- `construction_project` son las declaraciones de construcción de la CNE que
-- alimentan la ficha; `cne_capacidad_sync_log` es bitácora de sincronización.
-- Ninguna de las dos la necesita una ruta pública: la app entera está detrás de
-- login y las siete rutas públicas no las tocan.

alter policy construction_project_public_read on public.construction_project to authenticated;
alter policy cne_capacidad_sync_log_public_read on public.cne_capacidad_sync_log to authenticated;
