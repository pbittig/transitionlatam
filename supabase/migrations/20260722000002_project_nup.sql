-- NUP (Número Único de Proyecto) — el listado de Acceso Abierto lo trae para
-- el 85% de las solicitudes (2.350/2.758 verificado), pero el loader lo leía
-- y lo descartaba sin persistirlo. Se agrega la columna y se empieza a guardar.
alter table project add column if not exists nup text;
