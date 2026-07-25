-- Distingue "tecnología base + almacenamiento" (ej. "Solar con Baterías") sin
-- perder esa señal al mapear a un solo technology_id. Ver /docs/04-modelo-datos.md §4.8.

alter table project add column includes_storage boolean not null default false;
