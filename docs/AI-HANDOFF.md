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
