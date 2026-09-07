-- Constancia de aceptación de Términos y Condiciones / Política de Privacidad.
--
-- Sin esto, el checkbox del registro no tiene valor probatorio: hay que poder
-- demostrar QUÉ versión del texto aceptó cada usuario y CUÁNDO, no solo que
-- "hoy el formulario tiene un checkbox". Los usuarios creados antes de esta
-- migración (incluidos los de alta manual por admin) quedan con estas columnas
-- en null — es un hecho real (nunca aceptaron nada), no un dato que haya que
-- rellenar con un valor inventado.

alter table user_profile add column if not exists terms_accepted_at timestamptz;
alter table user_profile add column if not exists terms_version text;

comment on column user_profile.terms_accepted_at is
  'Momento en que el usuario aceptó los Términos y Condiciones y la Política de Privacidad vigentes en ese momento. Null si nunca los aceptó explícitamente (cuentas creadas antes de exigir el checkbox, o de alta manual por admin).';
comment on column user_profile.terms_version is
  'Identificador de la versión de los Términos/Política aceptada (ver docs/legal/), para poder pedir una nueva aceptación si el texto cambia sustancialmente.';
