-- La base deja de contestarle al rol `anon`, salvo el catálogo de planes.
--
-- Es el hallazgo "Crítico" de docs/security-audit-2026-07-29.md: las políticas
-- `public_read ... using (true)` dejaban a cualquiera consultar por REST, con la
-- anon key que viaja al navegador, las mismas tablas que la app cobra. Medido
-- contra producción el 2026-08-12, `anon` leía 23 tablas: company (936 filas),
-- spv (1.640), entity_relationship (9.518), data_attribution (10.065),
-- project (2.021 de 2.095, 39 columnas), transmission_line (1.656),
-- coordinador_empresa (1.303), power_plant (1.245), seia_record (234), y demás.
--
-- POR QUÉ ESTO NO ROMPE NADA: la app entera ya está detrás de login. `proxy.ts`
-- redirige a /ingresar todo lo que no sea /ingresar, /registro, /planes, /plans,
-- /admin/acceso, /recuperar-clave o /restablecer-clave. Ninguna de esas siete
-- lee estas tablas: /planes solo pide el perfil del usuario y /registro busca el
-- plan `free` con el cliente de servicio, que ignora RLS. O sea que estas
-- políticas no le servían a ninguna pantalla — solo a quien llamara al REST
-- directo. Los caminos que sí leen estas tablas con la anon key
-- (createSupabaseServerClient) corren siempre con sesión, es decir como
-- `authenticated`.
--
-- QUÉ NO RESUELVE: un usuario del plan gratuito autenticado sigue pudiendo leer
-- por REST lo que la UI le esconde. Cerrar eso es otro trabajo — vistas o RPC de
-- proyección mínima, como recomienda la auditoría — y toca el modelo de planes.
-- Acá se cierra la puerta que no tenía dueño; la de los planes sigue abierta.
--
-- Se usa `alter policy ... to authenticated` en vez de recrear: así el `using`
-- de cada una queda intacto. Importa, porque varias no son `true` — `project`
-- filtra por `editorial_status = 'published'`, `power_plant` y
-- `coordinador_empresa` por `is_hidden = false`, `company_shareholding` por
-- nivel de confianza y `data_attribution` excluye las filas de personas.
-- Recrearlas a mano sería la forma más fácil de perder uno de esos filtros.
--
-- Se dejan en `public` a propósito `plan`, `plan_feature` y `feature`: son el
-- catálogo comercial, la página de precios es pública y no dicen nada que no
-- esté publicado.

alter policy public_read on company to authenticated;
alter policy public_read on company_shareholding to authenticated;
alter policy public_read on connection_status to authenticated;
alter policy coordinador_empresa_public_read on coordinador_empresa to authenticated;
alter policy public_read on country to authenticated;
alter policy public_read_non_person on data_attribution to authenticated;
alter policy public_read on data_source to authenticated;
alter policy public_read on entity_alias to authenticated;
alter policy public_read on entity_relationship to authenticated;
alter policy formulario_ingest_log_public_read on formulario_ingest_log to authenticated;
alter policy public_read on location to authenticated;
alter policy public_read on market_signal to authenticated;
alter policy power_plant_public_read on power_plant to authenticated;
alter policy public_read_published on project to authenticated;
alter policy public_read on project_connection to authenticated;
alter policy public_read on project_event to authenticated;
alter policy public_read on region to authenticated;
alter policy public_read on seia_record to authenticated;
alter policy public_read on spv to authenticated;
alter policy substation_public_read on substation to authenticated;
alter policy public_read on technology to authenticated;
alter policy transmission_line_public_read on transmission_line to authenticated;

-- `data_attribution` tenía dos políticas de lectura y las políticas permisivas
-- se suman: `authenticated_read_all` ya cubre a los autenticados sin excluir las
-- filas de personas, así que dejarla convertía a la de arriba en decorativa.
-- Se acota a lo mismo que la otra — quién puede leer los datos de contacto lo
-- decide `person` (premium_read, 20260811000000), no una tabla de procedencia.
drop policy if exists authenticated_read_all on data_attribution;
