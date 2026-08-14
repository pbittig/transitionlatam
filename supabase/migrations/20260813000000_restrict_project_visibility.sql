-- Qué proyecto ve un cliente: publicado, de una tecnología que ofrecemos, y vivo.
--
-- Reúne dos reglas que hoy no se están aplicando.
--
-- 1. EL FILTRO POR TECNOLOGÍA VOLVIÓ. Las migraciones del 2026-07-22
--    (`20260722000005` y `...006`) ocultaban transmisión, minería, desaladora y
--    consumo reescribiendo la policy `public_read`. El 2026-07-29,
--    `20260729000000` introdujo el flujo editorial con `drop policy public_read`
--    + `create policy public_read_published`, y la condición nueva quedó siendo
--    solo `editorial_status = 'published'`: el filtro por tecnología se fue con
--    el drop y nadie lo notó. Desde entonces lo único que escondía un proyecto
--    era que alguien lo marcara `excluded` a mano.
--
-- 2. LOS RECHAZADOS Y DESISTIDOS DEJAN DE VERSE. No son de interés comercial.
--    Siguen en la tabla —no se borra nada— y quedan disponibles para una vista
--    aparte que los muestre a propósito.
--
-- POR QUÉ TECNOLOGÍA **Y** NOMBRE: medido el 2026-08-13, las tecnologías
-- `thermal`, `data_center` y `transmission` tienen 0 proyectos publicados. Un
-- filtro que mirara solo `technology_id` no habría tapado nada: los que se
-- escapan lo hacen por estar mal clasificados (una termoeléctrica marcada
-- `hybrid`) o sin clasificar. Por eso se filtra por las dos vías, igual que la
-- versión del 22-07.
--
-- SE REEMPLAZA LA POLICY, NO SE AGREGA OTRA. Las policies permisivas se suman:
-- una segunda ampliaría el acceso en vez de restringirlo.
--
-- CAMBIO RESPECTO A JULIO: los Data Center pasan a estar ocultos.
-- `20260722000006` los dejaba visibles como excepción explícita dentro de
-- `consumption`; el usuario lo revirtió el 2026-08-13 ("no térmicos, ni data,
-- ni de transmisión"). Hoy hay 0 data centers publicados, así que no saca nada
-- de la vista: deja la regla escrita para los que vengan.
--
-- OJO CON GEOTÉRMICA: `unaccent('geotérmica')` contiene la subcadena "termica".
-- Por eso los patrones térmicos llevan límites de palabra (`\m...\M`). Sin eso
-- esta policy escondería los proyectos geotérmicos, que son generación y deben
-- verse. Verificado en la simulación: geotérmica, biomasa, hidro y bombeo no
-- cambian de conteo.
--
-- NO CUBRE: 24 proyectos publicados no tienen `technology_id`. El patrón de
-- nombre alcanza a uno; del resto no se puede afirmar nada sin mirarlos.
-- Clasificarlos es trabajo aparte, no de una policy.

drop policy if exists public_read_published on project;

create policy public_read_published on project for select using (
  editorial_status = 'published'
  and status is distinct from 'Rechazada'
  and status is distinct from 'Desistida'
  and technology_id is distinct from (select id from technology where code = 'transmission')
  and technology_id is distinct from (select id from technology where code = 'thermal')
  and technology_id is distinct from (select id from technology where code = 'data_center')
  and technology_id is distinct from (select id from technology where code = 'consumption')
  and unaccent(lower(name)) !~ (
    'subestacion|linea de transmision|alimentador|seccionador|seccionamiento|transformador'
    || '|\mminera\M|\mmineria\M|\mminero\M'
    || '|desaladora|desalinizadora|desalacion|desalinizacion'
    || '|\mtermica\M|\mtermicas\M|\mtermico\M|\mtermicos\M'
    || '|\mtermoelectrica\M|\mtermoelectricas\M|\mtermoelectrico\M|\mtermoelectricos\M'
    || '|data center|datacenter|centro de datos'
  )
);
