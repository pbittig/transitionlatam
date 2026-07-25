-- Oculta de TODA la plataforma los proyectos de Transmisión, Minería y
-- Desaladora, a pedido explícito del usuario. Se hace vía RLS en vez de
-- filtrar en cada query/RPC porque casi todas las lecturas (listProjects,
-- getDashboardStats, getProjectsForMap, getPipelineFunnel,
-- getConnectionCalendar, getRequestAgeBenchmarks, getUpcomingScheduleInputs,
-- getSimilarProjects, getProjectById, etc.) usan la clave `anon` respetando
-- RLS — un solo cambio de política cubre todo, en vez de duplicar la
-- exclusión en ~10 archivos y funciones SQL distintas.
--
-- "Minería" y "Desaladora" NO tienen technology_id propio — 100% de esos
-- proyectos caen hoy bajo technology_id='consumption' junto a otros consumos
-- legítimos, así que la única señal real es el nombre (mismo mecanismo que ya
-- usa el chip "Transmisión y Distribución" en techChips.ts: la mayoría de esos
-- proyectos tampoco tiene technology_id='transmission', solo 13 de ~342 lo
-- tienen). Se reutilizan exactamente los mismos patrones de nombre ya
-- validados en ese chip para transmisión, más patrones equivalentes para
-- minería y desaladora.
--
-- No toca `power_plant` (centrales ya operativas) — esas categorías no
-- corresponden a ningún `plant_type` de generación existente ahí.

drop policy if exists public_read on project;

create policy public_read on project for select using (
  technology_id is distinct from (select id from technology where code = 'transmission')
  and unaccent(lower(name)) !~ (
    'subestacion|linea de transmision|alimentador|seccionador|seccionamiento|transformador'
    || '|\mminera\M|\mmineria\M|\mminero\M'
    || '|desaladora|desalinizadora|desalacion|desalinizacion'
  )
);
