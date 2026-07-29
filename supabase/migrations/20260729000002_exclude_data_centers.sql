-- Etapa actual del producto: solo generación renovable y BESS.
-- Data centers se archivan de forma reversible; no se eliminan sus relaciones.
update project p
set
  editorial_status = 'excluded',
  prefilter_status = 'out_of_scope',
  prefilter_category = 'out_of_scope',
  prefilter_reason = 'Data center fuera del alcance actual: foco en generación renovable y BESS.',
  editorial_reviewed_at = now(),
  published_at = null
where p.technology_id = (select id from technology where code = 'data_center' limit 1)
   or p.name ~* '(data[[:space:]]*cent(er|re)|datacenter|centro de datos|dc santiago|odata|ascenty|scala)';

