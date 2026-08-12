# PGP — Plataforma de Gestión de Proyectos (Coordinador Eléctrico Nacional)

Nombre correcto: **Plataforma** de Gestión de Proyectos. Varios comentarios del repo dicen "Programa de Grandes Proyectos" — está mal.

Cubre NI (Nuevas Instalaciones), MR (Modificaciones Relevantes) y MNR (Modificaciones No Relevantes). Es donde el titular reporta el avance de la interconexión al Coordinador. **Es la única fuente que tenemos sobre obra física.**

## Cómo se consulta

Dos endpoints, ambos sin autenticación (`lib/ingestion/sources/pgp/fetch.ts`):

- `GET /api/request/irs?project=<NUP>` — resuelve NUP → id de solicitud.
- `POST /api/request/get_request_info` — el `completition_status` confiable. El listado devuelve un valor desactualizado para solicitudes con árbol de fases grande.

Se consulta **NUP por NUP**, y sólo para proyectos elegibles (declarados en construcción o finalizados). Por eso la cobertura es acotada: 170 proyectos de 2.096 al 2026-08-12.

> **Trampa ya sufrida:** la lectura de proyectos elegibles no paginaba y PostgREST corta en 1.000 filas, así que el job veía 88 elegibles de 230. Dos tercios de los proyectos declarados nunca se consultaban, y el hueco resultante parecía una carencia de la fuente. Al paginar, la cobertura pasó de 73 a 170 proyectos.

## Campos que sirven

| Campo | Qué es | Cobertura (2026-08-12) |
|---|---|---|
| `completition_status` | Avance físico % — **el dato central** | 170 |
| `reception_date` | Recepción de la solicitud en PGP | 161 |
| `construction_declaration_date` | Fecha de declaración en construcción | 55 |
| `service_date` | Puesta en servicio registrada | 128 |
| `operative_date` | Entrada en operación registrada | 94 |
| `service_estimate_date` / `operative_estimate_date` | PES / EO **estimadas por el titular** | ~162 |
| `description` | Descripción técnica real del proyecto, escrita por el titular | 170 |
| `applicant.name`, `project_type`, `extra_data` | Solicitante, tecnología, región/comuna/tensión/punto de conexión | 170 |

## Campos que NO sirven

- **`completition_pes`**: vale `0` en el 100% de las observaciones. No habilita un estado de commissioning.
- **`finished` / `published`**: `false` en todas.
- **`phases` / `phases_context`**: el árbol trae 50-65 fases con nombres reales del proceso (CEM Definitiva, DUF, ANIT, SITR, Pruebas, Enlace), pero `is_ready` es `false` en 3.807 de 3.809 y los archivos adjuntos tienen ~2,9 fechas distintas por proyecto (cargas por lote). **No permite derivar la etapa actual** sin confirmación externa.
- **`stage`**: presente en pocos casos y sin diccionario conocido.

## Advertencia sobre las fechas "registradas"

`service_date` y `operative_date` son lo que el expediente tiene anotado, **no prueba de que el hito ocurrió**: de 94 proyectos con `operative_date`, 9 tienen avance físico menor a 100%, uno con 3%. Usarlas como hito sólo cuando concuerdan con `progress_percent = 100`.

## La señal comercial más fuerte del producto

Comparar la **fecha de conexión declarada al Coordinador** (Acceso Abierto) contra la **entrada en operación que el mismo titular estima en PGP**:

- 163 proyectos tienen ambas fechas.
- **138 (85%) difieren en más de 90 días.**
- Desviación promedio: **+750 días**. Máxima: +2.396.

Son dos declaraciones del mismo titular a la misma autoridad. No requiere modelo propio: es una resta.

## Cómo se modela hoy

- Ingesta: `lib/ingestion/sources/pgp/` (diaria, con cursor por lotes).
- Tabla: `pgp_project_progress_observation` (una fila por observación; el JSON completo queda en `source_payload`), vista `latest_pgp_project_progress`.
- Interpretación: `lib/shared/pgpProjectProgress.ts`.
- El avance esperado (`expected_progress_percent`, `deviation_pp`) es un **modelo nuestro** (curva S, `pdte-progress-1.0`), no un dato de PGP: siempre rotularlo como estimación.

Fuente: pgp.coordinador.cl.
