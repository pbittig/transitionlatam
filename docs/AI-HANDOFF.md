# Brief para retomar el proyecto (para otra instancia de Claude Code)

Este archivo existe para que **cualquier instancia de Claude Code que abra este repo** (por ejemplo, la que corre en el VPS vía Syncthing) tenga el mismo contexto operativo que una sesión que ya viene trabajando en el proyecto — no reemplaza `/docs/01-vision-producto.md` a `/docs/10-roadmap-mvp.md` ni `docs/DECISIONS.md` (eso es la arquitectura/producto formal), sino que resume **el estado reciente y las reglas de trabajo** que no están escritas en ningún otro lado.

**Convención:** actualizar este archivo con un resumen breve cada vez que termine una sesión de trabajo significativa, arriba del todo (más reciente primero). No hace falta detalle exhaustivo — para eso están los commits y `docs/DECISIONS.md`; acá va lo que alguien necesitaría saber ANTES de tocar código para no repetir investigación ya hecha o pisar algo a medio hacer.

---

## Reglas de trabajo en este repo (vigentes, confirmadas por el usuario 2026-08-10)

1. **Antes de modificar archivos, verificar `git status` primero.**
2. **Nunca `git reset`, `git clean`, ni borrar archivos sin preguntar antes** — ni siquiera si parecen scratch/temporales.
3. **Después de cambios importantes, mostrar `git status` + diff** sin que lo pidan.
4. **Commits y pushes a `main` solo con autorización explícita del usuario, en esa misma conversación** — una aprobación anterior no vale para el siguiente cambio.
5. **Syncthing sincroniza este proyecto entre un VPS y la PC del usuario.** Implicancias:
   - Pueden aparecer cambios en el working tree que no vienen de esta sesión ni de un mensaje del usuario — revisar `git status`/`git log` antes de asumir de dónde salieron.
   - `origin/main` puede avanzar sin que esta sesión haga push (otra instancia/el usuario puede pushear independientemente) — re-chequear antes de pushear.
6. **GitHub (`github.com/pbittig/transitionlatam`) es el repositorio oficial.** El proyecto de Vercel está conectado a este repo — un push a `main` dispara un deploy a producción automáticamente (además del camino manual `vercel --prod` por CLI, que también se ha usado en esta sesión para verificar fixes rápido).
7. **Planes de implementación cortos, no TDD exhaustivo por defecto** — el usuario prioriza eficiencia de tokens/tiempo sobre proceso formal, salvo que pida lo contrario.
8. **"Verificar" un proyecto en `/admin/verificador` solo debe cambiar `verified_at`** (y campos editoriales asociados) — nunca debe reescribir silenciosamente otros datos de la ficha ya cargados.

## Sesión 2026-08-12 (cierre) — energía derivada del PELP, y una limpieza que resultó ser mucho más grande

Lo del PELP quedó cerrado y desplegado. Lo de los datos de plantilla **no se
borró y no hay que borrarlo todavía**: al intentarlo apareció que el problema es
otro, bastante más ancho. Está en el punto 2.

### 1. Energía derivada del PELP (commit `1cf6b7a`)

Cierra el hueco que la sesión anterior dejó anotado más abajo:
`capacity_expansion_MWh` viene vacío en las 15.600 filas, así que la tabla
mostraba potencia y nada de duración — el número que distingue una batería de
100 MW por 2 horas de la misma por 8.

`energyMwhDerived` (MW × `duration_hours`) se **calcula al leer y no se
persiste**, para que `capacity_expansion_mwh` siga conteniendo exactamente lo
que publicó el ministerio (nada) y un cálculo nuestro no pueda confundirse
después con un dato oficial. Por eso mismo la columna va rotulada `·calc` y
lleva las horas usadas en cada fila. La duración no se asume: sale de
`max_hours`, y los 69 activos BESS de la expansión codifican sus horas en el
nombre (`BESS_Itahue220_8h`) y coinciden con `max_hours` en 69 de 69.

Verificado antes de commitear: `tsc --noEmit` limpio, `npm run lint` 0 errores
(queda 1 warning preexistente, `_capacityMw` en `projectPhaseDurations.ts`) y
`npm run build` completo.

### 2. Datos de plantilla: el alcance real es la ficha de 30 proyectos, no 13 filas

`scripts/delete-template-test-data.mjs` (commits `2850c8c` y el de esta
corrección). Se escribió para borrar 6 empresas, 6 personas y un proyecto de
relleno que dejó la plantilla en blanco del Formulario. Se corrió con `--apply`
y **murió en una violación de FK sin borrar nada** — la transacción revirtió,
que es lo que tenía que pasar. Lo que apareció al investigar el choque:

- **49 filas de `spv` tienen una de esas empresas como matriz**, y **30
  proyectos reales** —4 verificados— cuelgan de esas SPV por `project.spv_id`,
  que es `ON DELETE NO ACTION`. Borrar las empresas obliga a decidir qué pasa
  con esos 30 proyectos; no es cosa de agregarle un `delete` más al script.
- **27 de esos 30 proyectos muestran hoy una SPV inventada.** "BESS BRIDGE 5",
  "Parque Eólico Kumleufú", "Apolo" y 24 más aparecen con una sociedad vehículo
  llamada "Empresa de Energía S.A.", que no existe. Es el mismo problema que
  motivó el script, treinta veces más ancho de lo que el script cubría.
- **3 de las SPV son reales**: Bridge Almacenamiento Uno SpA, Bridge
  Almacenamiento 2 SpA y CMS SPV III SpA, colgadas de BESS Río Llanco, BESS
  Bridge 4 y PFV Los Llanos (los tres verificados). Tienen la sociedad correcta
  y la matriz inventada: hay que soltarles la matriz, no borrarlas. Es el mismo
  riesgo que motivó usar ids fijos en vez de un patrón de nombre (Metro de
  Santiago), un nivel más abajo, donde la primera versión no lo buscó.
- **No es un residuo de la primera semana.** La cabecera original decía "20-26
  de julio"; las SPV con nombre de plantilla se crearon hasta el **2026-08-10**,
  la última en el reprocesamiento del 9-10 de agosto. Lo que las escribe sigue
  vivo: limpiar sin tapar la fuente no dura.

El script ahora **aborta a propósito**, con la lista de SPV bloqueantes y sus
proyectos, y lo hace **también en simulación**. Antes la simulación daba verde
para una operación que la base rechaza —por eso el `--apply` sorprendió—; una
simulación que no falla donde falla el borrado no está simulando nada.

Orden para retomarlo (invertirlo obliga a repetir el trabajo): **(1)** tapar en
la ingesta del Formulario lo que escribe los valores de la plantilla; **(2)**
resolver las 49 SPV — soltar el `spv_id` de sus proyectos y borrar las 46
inventadas, dejar sin matriz las 3 reales; **(3)** recién ahí correr este script.

Dos decisiones quedaron abiertas, sin respuesta del usuario: si se arranca por
tapar la fuente o por limpiar, y si a las 3 SPV reales se las deja sin matriz o
se investiga a qué empresa pertenecen de verdad.

## Sesión 2026-08-12 — PELP: nueva fuente de expansión modelada

### Qué se integró

La Planificación Energética de Largo Plazo del Ministerio de Energía
(`energia.gob.cl/pelp/proyecciones-electricas`), modelo de expansión del SEN
(PyPSA-CL). **15.600 registros**, 5 escenarios, 2026–2057, 234 nodos, 91 comunas.
Nueva sección `/expansion-futura` y sync mensual (`scripts/sync-pelp.ts`).

### Cómo se accede a la fuente (no es scraping)

La página embebe un Power BI publicado con "Publicar en la web". En ese modo el
bootstrap declara `powerBIAccessToken = 'any'` y `reportId = 'any'`: **la
resource key sola autentica**, no hay OAuth. Tres llamadas REST anónimas:

```
Host  wabi-south-central-us-api.analysis.windows.net    <- el -api, NO el -redirect (403 en todo)
Auth  X-PowerBI-ResourceKey: 8cd41d5d-f70d-4dc3-8549-ff5bbee44509
      + Referer: https://app.powerbi.com/

GET  /public/reports/{resourceKey}/modelsAndExploration   -> modelId 13117170
POST /public/reports/conceptualschema  {"modelIds":[...]} -> las 22 tablas del modelo
POST /public/reports/querydata                            -> los datos
```

Esto se descubrió con **captura CDP sobre el Chrome ya instalado** (no hace falta
Playwright: Node 22 trae `WebSocket` global). Adivinar endpoints no funcionó.
La respuesta viene en DSR comprimido —bitmask `R` de repetición + diccionarios de
valores— y hay que decodificarlo o la tabla sale corrida (ver `fetch.ts`).

### Lo que el descubrimiento evitó

La tabla visible del reporte muestra **476 filas de 15.600**. Power BI aplica dos
filtros que el usuario no ve: escenario E2 y expansión ≥ 0,01 GW. Scrapear lo
renderizado habría capturado el 3% de la fuente. Validación: extrayendo *con*
esos dos filtros salen exactamente 476 filas, igual que Power BI.

### Trampas de los datos, ya resueltas

- **12.153 de 15.600 filas traen 0 MW.** No son datos faltantes: el modelo emite
  una fila por candidato y año, y 0 significa "no se expandió ese año". Se
  guardan (es información real) pero la tabla las oculta por defecto.
- **`capacity_expansion_MWh` viene vacío en el 100%** — cadena vacía en el
  origen, no pérdida nuestra. La duración de BESS sale de `max_hours` del
  diccionario de almacenamiento (244 de 245 activos) y **nunca se asume**.
- **Los escenarios no se suman.** Son futuros alternativos; sumarlos da 207 GW
  solares, que no ocurre en ninguno. `getPelpExpansionForScenario` no tiene
  variante sin escenario para que el error no esté disponible.
- El acumulado por tecnología se recalcula; `capacity_expansion_cumulative_MW`
  acumula *por activo* y sumarlo entre activos contaría de más.

### Por qué NO está en `project`

Son candidatos de optimización, no proyectos: la fuente los agrupa bajo
"2. [resultados]" y marca `p_nom_extendable` / `candidate`. Un activo llamado
`solar PV_Antofagasta_39` es un identificador sintético, no una sociedad. Viven
en tablas `pelp_*` para que ninguna consulta del dashboard, el mapa, el CRM o
Transition AI tenga que acordarse de excluirlos.

### Pendiente

El ministerio publica la base en SharePoint
(`minenergia-my.sharepoint.com/.../PELP 2028-2032 - Dashboard...`), pero exige
autenticación del tenant. Falta un enlace público para contrastar si el MWh de
BESS está poblado en el archivo base.

### Lección de esta sesión (costó un build roto)

**No editar archivos fuente con reemplazos de PowerShell.** `Get-Content -Raw`
sin `-Encoding` lee UTF-8 como ANSI en PS 5.1, y `Set-Content -Encoding utf8`
reescribe el mojibake y agrega BOM: "Expansión" llegó a la página como
"ExpansiÃ³n". Usar el editor.

## Sesión 2026-08-11 — el entorno se mudó a un VPS y los syncs salieron de Vercel

### Dónde corre ahora el desarrollo

Hay un **VPS Windows** (zona horaria Pacific, UTC-7) espejado con la PC por Syncthing, y es donde se trabaja. Cosas que hay que saber antes de tocar nada ahí:

- **Node 22.23.2 + npm 10.9.8** viven en `C:\Users\Admin\tools\nodejs`, **fuera del repo** a propósito, para que Syncthing no replique el runtime. Cualquier herramienta futura va en `C:\Users\Admin\tools\`, nunca dentro del proyecto.
- El `package-lock.json` fue generado con **npm 11+** (el de la PC). El npm 10.9.8 del VPS le borra 57 bloques de metadata `libc` al reescribirlo. **Usar `npm ci`, no `npm install`.**
- **El VPS no tiene credenciales de GitHub.** Se puede commitear ahí, pero el `push` sale de la PC. Como `.git` viaja por Syncthing, el commit aparece solo del otro lado.
- **Syncthing sincroniza también `.git`, `node_modules` y `.next`.** Eso explica worktrees fantasma apuntando a rutas de la otra máquina y `git status` distintos en cada lado sobre archivos idénticos (mtime tocado ⇒ modificación falsa; `git diff` sale vacío). Pendiente: excluirlos y dejar que el código viaje por GitHub.

### Producción estuvo rota y nadie se enteró

`next build` fallaba desde `7f5b3d9` (2026-08-10): `@firecrawl/pdf-inspector` trae un asset no-ECMAScript que Turbopack no puede empacar en un chunk ESM. Como un push a `main` despliega, **el deploy de ese commit nunca salió**. Arreglado marcándolo en `serverExternalPackages` — el mismo patrón que ya existía para `pdf-parse`/`pdfjs-dist`/`@napi-rs/canvas`. Iba junto con 2 errores de lint (`react/no-unescaped-entities`). Moraleja: correr `npm run lint && npm run build` antes de pushear, sobre todo al agregar una dependencia nueva.

### Los syncs ya no corren en Vercel

Decisión del usuario: **todos los jobs corren desde el VPS**, los Vercel Cron se apagan. El motivo es duro: `maxDuration=60` del plan Hobby no alcanza. `sync-listado` tarda ~30 min por pasada completa y `sync-sea-pertinencia` **murió por timeout todos los días entre el 2026-08-06 y el 2026-08-11** sin cerrar su fila de `cron_run_log` — quedaba en `running` para siempre, así que no aparecía como error en ningún lado. Última corrida buena: 2026-08-05.

- `scripts/run-syncs.ps1 -Set daily|weekly|all` los corre en secuencia. Un job que falla no detiene a los demás; todos siguen escribiendo en `cron_run_log`, así que `/admin/operacion` sigue siendo la fuente de verdad.
- **El .ps1 se mantiene en ASCII puro.** Windows PowerShell 5.1 lee los `.ps1` sin BOM como ANSI, y un acento dentro de una cadena rompe el parseo del script entero.
- Scripts nuevos porque no existían: `sync-pgp-progress.ts` (itera hasta cerrar el ciclo, en vez de 20 por día) y `compute-schedule-calibration.ts`.
- **`sync-cne-capacidad-remote.ts` vs `sync-cne-capacidad.ts`:** el viejo lee un CSV estático de `dataset/` del 2026-07-21; el nuevo descarga la versión vigente, como hace el cron. Para desatendido va **siempre el `-remote`**. El viejo se dejó intacto porque su cabecera guarda un hallazgo sin terminar sobre la API pública de Energía Abierta (apikey embebido, ~25 datasets más).
- Tareas `TransitionLatam-Syncs-Diario` (09:00 local = 16:00 UTC) y `-Semanal` (lunes 05:00 = 12:00 UTC) registradas **deshabilitadas**: habilitarlas antes de vaciar los `crons` de `vercel.json` haría que los dos sistemas escriban las mismas filas a la misma hora.
- Fuera del runner a propósito: `sync-cne-construccion` (depende de un `.xlsx` bajado a mano) y `sync-formulario-bulk` (consume IA por lote, se corre a demanda).
- La tarea `TransitionLatam-SyncListado-Diario` de la **PC quedó `Disabled`**.

### Pendientes que esta sesión dejó identificados

- **Reportes diarios que no llegaban — resuelto, pero la causa raíz quedó sin identificar.** `daily-project-report` era el único cron que no escribía en `cron_run_log`, así que no aparecía en `/admin/operacion` ni corriendo ni fallando; y `sendInternalNotification` devolvía `void`, de modo que un envío omitido por falta de `RESEND_API_KEY` se reportaba como éxito. Ambas cosas están arregladas. **Pero la hipótesis de que faltaba `RESEND_API_KEY` resultó falsa:** está en Production desde hace 14 días. El envío se verificó a mano desde el VPS y el correo llegó, así que Resend, el dominio y el SPF/DKIM funcionan. Los logs de Vercel en este plan solo retienen minutos, así que no se pudo reconstruir por qué fallaba desde ahí. Como el job ahora corre desde el VPS y sí registra, si vuelve a fallar se va a ver.
- **`sea-pertinencia` tarda más de 30 min** por los timeouts de detalle uno a uno, y las pertinencias de 2020–2023 devuelven `Respuesta sin objeto 'pertinencia'`. Nunca se supo antes porque en Vercel moría al minuto.
- **La auditoría de seguridad del 2026-07-29 sigue con hallazgos abiertos**: `company`, `spv`, `seia_record` y `market_signal` conservan `public_read using (true)` para `anon`, y `person` (los contactos) es legible por cualquier autenticado. `opportunity` sí se cerró en `20260803000002`.
- **El VPS quedó en hora de Santiago (UTC-4)**, no en Pacific como al instalarlo. Los disparadores de las tareas guardan el instante absoluto, así que siguen corriendo a las **16:00 UTC (diaria)** y **12:00 UTC (lunes)** — los mismos momentos que tenían los Vercel Cron — pero ahora se leen como 12:00 y 08:00 hora Chile. Ojo con cambiar la zona horaria mientras una tarea corre: el salto de reloj hace que el Programador crea que lleva más tiempo del real y puede matarla por `ExecutionTimeLimit` (pasó el 2026-08-11; el límite se subió a 8 h).
- **Los scripts locales no siempre tienen los mismos valores por defecto que su ruta de cron.** `preverify-projects.ts` sin `--apply` corre en simulación: consume ~10 min de IA y no escribe ningún campo. `run-syncs.ps1` ya pasa los argumentos correctos, verificados uno a uno contra cada `route.ts`. Antes de agregar un job al runner, comparar sus defaults con los del cron equivalente.

## Estado del proyecto — resumen al 2026-08-10

### Qué es
Plataforma de inteligencia de mercado (Project Intelligence, no Market/Sales Intelligence) para la transición energética en Chile (ONIX Consulting Group). Next.js 16 (App Router, Turbopack) + TypeScript strict + Supabase (Postgres/Auth) + Tailwind v4, hosting en Vercel. Ver `README.md` y `docs/01-vision-producto.md`.

**Importante:** `AGENTS.md`/`CLAUDE.md` en la raíz advierten que esta versión de Next.js tiene breaking changes respecto al training data del modelo — leer `node_modules/next/dist/docs/` antes de asumir APIs/convenciones conocidas.

### Fuentes de datos activas
Energía Abierta (listado + detalle-formulario, Nivel 1/2) + Coordinador Eléctrico Nacional (SIPUB: centrales operativas, empresas/grupos) + SEIA (matching ambiental) + SEA Pertinencia (fallback cuando SEIA no matchea). Revisión periódica semanal confirmada como requisito (ADR-014). Ver `docs/DECISIONS.md` para el historial completo de decisiones arquitectónicas (ADR-001 a ADR-019 al momento de escribir esto).

### Trabajo reciente (sesión 2026-08-09/10, resumen)

**Verificación de proyectos — ciclo grande de fixes**, motivado por que el flujo manual de verificación (`/admin/verificador`) era demasiado lento y perdía datos:

1. **Bug raíz encontrado y arreglado:** el sync diario de `energia-abierta/listado` sobreescribía silenciosamente con `null` datos ya extraídos correctamente por IA (`projectFieldsWithoutNulls` en `load.ts` — nunca pisar un valor bueno con un `null` de una fuente menos detallada). Se restauraron 214 proyectos/449 campos afectados desde reportes de pre-verificación ya guardados.
2. **Crash de producción en `/admin/verificador`** al guardar cualquier campo (`ReferenceError: DOMMatrix is not defined`, cadena `pdf-parse`→`pdfjs-dist`→`@napi-rs/canvas`) — 2 intentos fallidos (instalar el paquete, `serverExternalPackages`), arreglado recién al aislar los imports de `pdf-parse` con `await import()` dinámico dentro de las funciones que los usan (nunca estático a nivel de módulo), para que un fallo de PDF no tumbe TODO el bundle de server actions de la página (incluido el botón "Verificado").
3. **RUT/dirección legal:** se amplió la búsqueda de "Informe de autorización de conexión" para incluir variantes "definitivo"/"fehaciente" (antes solo "preliminar"), y se extendió el prompt de IA para extraer estos campos de empresa.
4. **~53 grupos de empresas duplicadas** (por acento/mayúscula/espacio) fusionados de forma segura (RUT válido gana como canónico, `entity_relationship` repuntado, 1 caso con RUTs genuinamente distintos correctamente NO fusionado).
5. **Pedido explícito del usuario, 5 entregables (A-E), todos completados:**
   - A) Botón manual de asociación a Pertinencia en `/admin/verificador`.
   - B) Preferir `.xlsx` sobre `.pdf` al elegir el documento Formulario (4 call sites corregidos).
   - C) Matching SEIA ahora usa el nombre de la empresa desarrolladora para desambiguar (evita, ej., que un proyecto BESS matchee con un parque eólico sin relación que comparte nombre de sitio).
   - D) Fallback automático a Pertinencia cuando SEIA no encuentra nada (nunca auto-confirma, solo sugiere — doctrina semi-asistida de `docs/04-modelo-datos.md` §4.6).
   - E) Reprocesamiento del backlog de proyectos "verificados" con 0 contactos.
6. **Botón "Verificado" que se colgaba (8-84s+, a veces indefinidamente):** `markProjectVerified` esperaba de forma bloqueante el refresco de contactos, que en proyectos con Formulario PDF pasa por IA (NVIDIA NIM) sin timeout. Fix: timeout de 25s en `nvidia.ts` + refresco de contactos movido a `after()` (Next.js) para correr en segundo plano sin bloquear la respuesta al usuario.
7. **Parser determinístico de PDF (sin IA), usando `@firecrawl/pdf-inspector`:** el texto de `pdf-parse` viene desordenado (orden interno del PDF, no visual), lo que causaba errores reales de la IA asociando mal nombre/teléfono/email de coordinadores de proyecto. `pdf-inspector` da coordenadas X/Y reales por ítem de texto — con eso se reconstruyen pares etiqueta→valor sin adivinar nada. Validado contra 20 Formularios PDF reales: 20/20 reconocidos, adyacencia etiqueta-valor pasó de 2/20 a 20/20 para RUT/e-mail. Implementado en `lib/ingestion/sources/energia-abierta/detalle-formulario/parsePdfPositioned.ts`, usado como primer intento en `parsePdf.ts` (cae a la IA solo si no reconoce la plantilla). Re-correr `scripts/reprocess-zero-contact-projects.ts` con este fix recuperó 37 proyectos más sin usar IA para nada.

**Pendiente identificado, no bloqueante:**
- 24 proyectos con PDF Formulario que el parser determinístico no reconoce: mayoría son PDFs escaneados (imagen, sin texto extraíble — necesitarían OCR real, feature distinta) o el documento adjuntado como "Formulario" en el portal es en realidad otro tipo (Carta Gantt, Declaración Jurada) — no es un problema del parser, es de qué documento se seleccionó.
- NVIDIA NIM (proveedor de IA para el fallback) estuvo caído/con timeouts constantes durante buena parte de esta sesión — no es un bug del código, es confiabilidad del tier gratuito.
- Asimetría en la doctrina semi-asistida: el matching SEIA escribe `project_id` automáticamente incluso en confianza "baja"/"media" (a diferencia de Pertinencia, que solo sugiere) — se mejoró la precisión del matching (ADR/commit `6bac0a7`) pero no se agregó una compuerta de revisión humana explícita. Queda como mejora futura si se decide abordarla.
- Reorganización del dashboard admin (categorías colapsables), restructuración de la ficha de proyecto (Health Score, cronograma con overrides de estado real, búsqueda de hermano SUCTD), y tabla "Proyectos Esperados" (barra de avance de construcción PGP en vez de Health Score/CRM) — todo esto ya está en `main`, ver `git log` para los commits específicos si hace falta el detalle.

### Dónde mirar primero para profundizar
- `docs/DECISIONS.md` — decisiones arquitectónicas (ADR-001 a ADR-019+), incluye el detalle completo de por qué se eligió IA solo para el caso de PDF rico desordenado (ADR-016) y NVIDIA NIM como proveedor (ADR-017).
- `lib/ingestion/sources/energia-abierta/detalle-formulario/` — todo el pipeline de extracción del Formulario (Excel, PDF checklist, PDF rico determinístico, fallback IA).
- `lib/ai/preverification/` — pre-verificación asistida por IA, aplicación atómica de campos de alta confianza.
- `git log --oneline` — historial reciente es la fuente más confiable de "qué se hizo" con mensajes descriptivos del porqué, no solo el qué.
