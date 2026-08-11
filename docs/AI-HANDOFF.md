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
- El VPS está en Pacific Time: como PST y Chile cambian de horario de verano en fechas distintas, los horarios locales se desfasarán una hora dos veces al año respecto de los UTC originales.

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
