-- El RUT es una clave de de-duplicación de empresas mucho más confiable que el
-- nombre — ya vimos en los Formularios reales que la misma empresa aparece
-- escrita "Greengate Energía SpA" y "Greengate Energy SpA" en el mismo envío.
-- Reference: /docs/04-modelo-datos.md §4.6, §4.8

alter table company add column rut text;
create unique index company_rut_unique_idx on company (rut) where rut is not null;
