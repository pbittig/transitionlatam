# Ficha de proyecto — hitos PGP de Puesta en Servicio y Entrada en Operación

**Estado:** aprobado para preparación
**Fecha:** 2026-08-07
**Alcance:** `lib/ingestion/sources/pgp/fetch.ts`, `lib/ingestion/sources/pgp/runSync.ts`, `lib/data-access/pgpProgress.ts`, `app/(public)/proyectos/[id]/page.tsx`, `app/(public)/proyectos/[id]/PhaseTimeline.tsx`, migración nueva en `supabase/migrations/`

## 1. Objetivo

La ficha de proyecto ya muestra el % de avance físico reportado en el PGP del Coordinador (sección "Construcción física reportada"). Ese mismo expediente del PGP también reporta dos fechas objetivo por proyecto — **Puesta en Servicio (PES)** y **Entrada en Operación (EO)** — cada una con una fecha "Estimada" y una fecha "Real" (vacía hasta que el hito se cumple). Este trabajo:

1. Captura esas dos fechas estimadas en el sync existente.
2. Las muestra en un cuadro nuevo dentro de la ficha, junto al resto de la información del PGP.
3. Las agrega como dos hitos adicionales al cronograma visual (`PhaseTimeline`), sin modificar el modelo probabilístico de duraciones.

## 2. Fuera de alcance

- **Fecha "Real".** No existe como campo independiente en la API pública del PGP (`GET /api/request/irs`, `POST /api/request/get_request_info`) — se investigó explícitamente y no se encontró un proyecto ya en operación en el PGP para confirmar qué campo se puebla al cumplirse el hito. Este trabajo siempre guarda y muestra `null`/"—" para "Real". Cuando aparezca el primer caso real, se revisita en otra tarea.
- **Cálculo de desviación agregada y recalibración del modelo de duraciones** (`lib/shared/projectPhaseDurations.ts`, `lib/shared/projectTimelineEstimator.ts`). Es un proyecto aparte que requiere acumular observaciones de muchos proyectos primero. Este trabajo solo guarda las fechas base que ese proyecto futuro va a necesitar — no calcula ni muestra ninguna desviación.
- No se modifica `computeEstimatedPhase` ni la taxonomía de `PhaseKey` — los hitos PGP son un dato de una fuente distinta (confirmado por el Coordinador para ese proyecto puntual), no una fase más del modelo compartido.

## 3. Captura de datos

### 3.1 Fuente

`POST https://pgp.coordinador.cl/api/request/get_request_info` con body `{"ir": "<id>"}` — el mismo endpoint que ya se usa (ver `fetchAccurateCompletion` en `lib/ingestion/sources/pgp/fetch.ts`) para corregir `completition_status`. La respuesta ya incluye `service_estimate_date` y `operative_estimate_date` (ISO 8601, ej. `"2026-12-15T00:00:00"`); no hace falta ninguna llamada adicional a la API.

### 3.2 Cambios en `fetch.ts`

- `fetchAccurateCompletion` pasa a devolver también `serviceEstimateDate: string | null` y `operativeEstimateDate: string | null` (fecha en formato `YYYY-MM-DD`, tomando solo la parte de fecha del ISO string; `null` si el campo viene ausente o no parsea).
- `PgpProjectProgress` (la interfaz que devuelve `fetchPgpProjectProgress`) gana los mismos dos campos, poblados en el mismo paso donde hoy se sobrescribe `progressPercent`.

### 3.3 Migración nueva

`supabase/migrations/20260807000000_pgp_pes_eo_dates.sql`:

```sql
alter table pgp_project_progress_observation
  add column if not exists service_estimate_date date,
  add column if not exists operative_estimate_date date;

create or replace view latest_pgp_project_progress
with (security_invoker = true) as
select distinct on (project_id)
  project_id,
  nup,
  progress_percent,
  declared_cod_snapshot,
  expected_progress_percent,
  deviation_pp,
  model_version,
  service_estimate_date,
  operative_estimate_date,
  observed_at,
  source_url
from pgp_project_progress_observation
order by project_id, observed_at desc;
```

### 3.4 `runSync.ts`

El `insert` en `pgp_project_progress_observation` dentro de `runPgpProgressSync` agrega `service_estimate_date: reading.serviceEstimateDate` y `operative_estimate_date: reading.operativeEstimateDate` al objeto de la observación. Sin cambios en la lógica de elegibilidad, cursor ni deduplicación — estas dos fechas viajan junto con la misma observación que ya se inserta por el cambio de `progress_percent`.

**Nota:** dado que la condición actual de "insertar solo si cambió" compara únicamente `progress_percent` (`lib/ingestion/sources/pgp/runSync.ts`, variable `unchanged`), si el % no cambió pero la fecha estimada sí, no se registra una fila nueva por ahora. Esto es aceptable para este alcance (las fechas estimadas cambian con mucha menor frecuencia que el %); no se rediseña la condición de "sin cambios" en este trabajo.

### 3.5 `lib/data-access/pgpProgress.ts`

`LatestPgpProgress` gana `serviceEstimateDate: string | null` y `operativeEstimateDate: string | null`; `getLatestPgpProgress` los selecciona de la vista y los mapea igual que los demás campos.

## 4. Cuadro en la ficha

Dentro de la sección existente "Construcción física reportada" (`page.tsx`, el bloque `{pgpProgress && pgpReading && (...)}`), inmediatamente después del bloque `"Avance esperado" / "Desviación de cronograma"` ya existente, se agrega — solo si al menos una de las dos fechas existe:

```
┌─────────────────────────────┬─────────────────────────────┐
│ Puesta en Servicio           │ Entrada en Operación         │
│ Estimada: 15/12/2026         │ Estimada: 03/03/2027         │
│ Real: —                      │ Real: —                      │
└─────────────────────────────┴─────────────────────────────┘
```

Mismo lenguaje visual que el bloque contiguo (`rounded-md bg-neutral-50 p-3 dark:bg-neutral-900`, grid de 2 columnas). Fechas formateadas con el mismo `toLocaleDateString` bilingüe usado en el resto del archivo. Si una fecha individual falta, esa mitad muestra "Estimada: —".

## 5. Hitos en `PhaseTimeline`

### 5.1 Prop nuevo

```ts
export interface PgpTimelineMilestone {
  label: string;       // "Puesta en Servicio" / "Entrada en Operación" (ya resuelto por locale por el caller)
  date: string;         // YYYY-MM-DD
}

// PhaseTimeline({ milestones, connectionDate, pgpMilestones, today, locale })
pgpMilestones?: PgpTimelineMilestone[];
```

`page.tsx` construye este array a partir de `pgpProgress.serviceEstimateDate` / `operativeEstimateDate` (omitiendo los que sean `null`) y lo pasa solo cuando `estimatedPhase` también existe (mismo bloque condicional que ya envuelve `<PhaseTimeline>`).

### 5.2 Render

- El rango de fechas del eje (`minDate`/`span`, hoy calculado solo desde `milestones` y `connectionDate`) se extiende para incluir también las fechas de `pgpMilestones` si caen fuera del rango actual — mismo `Math.min`/`Math.max`, sin cambiar la fórmula de `pct()`.
- Cada hito PGP se dibuja como una fila más, mismo grid de 2 columnas (label a la izquierda, línea de tiempo a la derecha), pero en vez de la barra con banda de incertidumbre (`repeating-linear-gradient`) de las fases modeladas, se dibuja un **marcador puntual** (un rombo/pin sólido en la posición exacta de la fecha) con un color distinto (gris neutro oscuro, no uno de `PHASE_COLORS`, para no sugerir que pertenece a la taxonomía de fases del modelo) y su fecha como etiqueta.
- Leyenda (`mt-4 flex ... gap-x-5`) gana un tercer ítem: `◆ Hito confirmado por el Coordinador (PGP)`.
- Si `pgpMilestones` no se pasa o viene vacío, el render es idéntico al actual — cambio aditivo, no hay rama que afecte a proyectos sin PGP.

## 6. Testing

- Verificación manual con `npm run dev` (como en el trabajo anterior de esta ficha): un proyecto con `pgpProgress` que tenga ambas fechas, uno con solo una, uno sin ninguna (el cuadro no debe aparecer), y confirmar visualmente que el cronograma extiende el eje correctamente cuando una fecha PGP cae después de la fecha de conexión declarada.
- Sin testing automatizado nuevo — mismo criterio que el resto de esta ficha (no hay framework de test en el repo).
