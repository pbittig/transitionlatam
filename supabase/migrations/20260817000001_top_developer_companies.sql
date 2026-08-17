-- Las empresas con más proyectos, contadas en la base y no en la app.
--
-- Antes esto se armaba pidiendo `select developer_company_id from project` y
-- contando en memoria. PostgREST corta en 1.000 filas por defecto, así que el
-- conteo se hacía sobre 1.000 de los 2.096 proyectos: el selector mostraba
-- "Grenergy · 49 proyectos" mientras su propia cartera, más abajo en la misma
-- pantalla, listaba 106. Dos números distintos para lo mismo, a un scroll de
-- distancia.
--
-- Cuenta solo proyectos publicados, igual que `getOwnerPortfolio`: el número
-- que acompaña al nombre tiene que ser el largo de la lista que se abre al
-- elegirlo.
--
-- Sin `security definer`: se ejecuta con los permisos de quien llama, de modo
-- que las políticas de fila siguen aplicando y un cliente no cuenta proyectos
-- que no puede ver.

create or replace function top_developer_companies(p_limit integer default 40)
returns table (id uuid, name text, project_count integer)
language sql
stable
as $$
  select c.id, c.name, count(*)::int as project_count
  from project p
  join company c on c.id = p.developer_company_id
  where p.developer_company_id is not null and p.editorial_status = 'published'
  group by c.id, c.name
  order by count(*) desc, c.name
  limit p_limit;
$$;

-- Los cuatro indicadores del encabezado de Propietarios se sacaron de la
-- pantalla, así que esta función se queda sin quien la llame.
drop function if exists count_companies_with_projects();
