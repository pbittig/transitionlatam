-- Vuelve a cerrarle `project` al rol `anon`. Se había reabierto solo.
--
-- QUÉ PASÓ: `20260812000005` acotó `public_read_published` a `authenticated`.
-- Al día siguiente, `20260813000000` reescribió esa misma policy para agregar
-- el filtro por tecnología y estado — con `drop policy` + `create policy`, y sin
-- repetir el `to authenticated`. La policy nueva volvió al default (`public`),
-- así que `anon` recuperó la lectura: 950 proyectos publicados con sus 39
-- columnas, disponibles para cualquiera con la anon key, desde el 2026-08-15.
--
-- Es exactamente el mismo mecanismo que borró el filtro por tecnología el
-- 2026-07-29 y que quedó documentado en esa migración. Escribir la advertencia
-- no evitó repetirla: `create policy` no hereda nada de la que reemplaza, y no
-- avisa de lo que se pierde.
--
-- POR QUÉ NO LO VIO EL GUARDIÁN: `check-project-visibility.ts` pregunta QUÉ se
-- ve, no QUIÉN lo ve — corre como `authenticated` y ahí todo estaba correcto.
-- Quien sí lo detecta es `check-anon-access.ts`, pero se corría a mano. En el
-- mismo commit que esta migración pasa a correr en el set diario.

alter policy public_read_published on project to authenticated;
