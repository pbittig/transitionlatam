-- Alinea los totales del pipeline con la regla de vigencia que ya usan el
-- listado (listProjects), la cola del verificador (applyPeriodFilter) y los
-- insumos de cronograma (applyVigenteScope).
--
-- Antes esta función usaba "fecha de conexión desde el inicio de mes", así que
-- la misma pantalla mostraba dos totales distintos de proyectos vigentes: 810
-- en el listado y 636 en el encabezado.
--
-- La regla: un proyecto sigue vigente mientras no esté construido. Después de
-- su fecha de conexión declarada se le dan 100 días de observación para
-- detectar si la obra arranca; si arranca, se queda hasta terminar. El avance
-- de PGP manda sobre la fecha declarada en las dos direcciones — si está en PGP
-- sin llegar al 100% se queda aunque la ventana haya vencido, y si llegó al
-- 100% sale aunque su fecha sea futura.
--
-- La ventana existe porque la fecha declarada es sistemáticamente optimista:
-- contra la propia estimación del titular en PGP la desviación promedio es de
-- +750 días (163 proyectos con ambas fechas, 138 con más de 90 días de atraso).
--
-- Mantener este criterio en dos lenguajes (SQL y TypeScript) es una deuda
-- conocida: si cambia, hay que cambiarlo en ambos. Se documenta acá y en
-- lib/data-access/projects.ts (VIGENCIA_GRACE_DAYS).

create or replace function get_pipeline_scope_totals()
returns json
language sql
stable
as $$
  with built as (
    select project_id from latest_pgp_project_progress where progress_percent >= 100
  ),
  under_construction as (
    select project_id from latest_pgp_project_progress where progress_percent < 100
  ),
  clasificado as (
    select
      p.capacity_mw,
      (
        p.status not in ('Rechazada', 'Desistida')
        and p.id not in (select project_id from built)
        and (
          p.estimated_connection_date >= current_date - 100
          or p.estimated_connection_date is null
          -- La fuente mezcla "construcción"/"construccion"/mayúsculas: se
          -- compara sin tildes y por prefijo, igual que en el código.
          or lower(translate(p.status, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) like 'proyecto declarado en construc%'
          or p.id in (select project_id from under_construction)
        )
      ) as vigente
    from project p
  )
  select json_build_object(
    'esperados', (
      select json_build_object('count', count(*), 'totalCapacityMw', coalesce(sum(capacity_mw), 0))
      from clasificado where vigente
    ),
    'historico', (
      select json_build_object('count', count(*), 'totalCapacityMw', coalesce(sum(capacity_mw), 0))
      from clasificado where not vigente
    )
  );
$$;

grant execute on function get_pipeline_scope_totals() to anon, authenticated;
