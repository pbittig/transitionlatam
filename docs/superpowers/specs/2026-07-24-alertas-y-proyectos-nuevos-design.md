# Motor de eventos, sync cada 24h, y dashboard de Alertas ampliado

**Fecha:** 2026-07-24
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

El usuario pidió dos cosas relacionadas: (1) en "Proyectos futuros", un panel que
muestre los proyectos nuevos detectados en las últimas 24 horas; (2) ampliar `/alertas`
a un mini-dashboard — proyectos seguidos (con opción de dejar de seguir), un feed
opcional de proyectos nuevos, y detección de cambios de avance (punto de conexión,
fecha estimada, estado, SEIA) para los proyectos que se siguen — dejando explícito qué
dispara cada aviso. Pidió explícitamente que fuera eficiente y validó que los avisos
sean solo dentro de la app por ahora (sin correo).

Al revisar el código existente se encontró que gran parte de la base ya está construida
mas no conectada:

- `followed_project` (seguir/dejar de seguir) y `FollowButton`/`toggleFollow` ya
  funcionan en la ficha del proyecto.
- `project_event` ya tiene el vocabulario completo de tipos de evento en su `CHECK`
  (`status_change`, `connection_date_change`, `seia_milestone`, etc.) y las columnas
  `previous_value`/`new_value` para guardar el diff — pero **hoy solo se escribe el tipo
  `announced`**, al crear un proyecto nuevo. El resto del vocabulario no lo genera nadie
  todavía (`ActivityTimeline.tsx` ya tiene un aviso propio de esto: "cuando tengamos una
  segunda sincronización del listado con diff de estados, este timeline también mostrará
  cambios de estado y hitos SEIA").
- `/alertas` ya lista seguidos + eventos de seguidos (`getWatchlistEvents`), pero como
  no hay más que `announced`, en la práctica nunca muestra nada después de la primera
  vez que se sigue un proyecto.

Este documento cubre tres piezas secuenciales — la 1 habilita a la 2 y 3, así que se
documentan juntas aunque el plan de implementación las divida en tareas:

## A. Motor de eventos (diffing en cada sync)

### A.1 Listado sync (`lib/ingestion/sources/energia-abierta/listado/load.ts`)

`processRow()` ya distingue creación vs actualización de un proyecto existente
(`existingProject`). Hoy esa consulta solo trae `id`; pasa a traer también `status` y
`estimated_connection_date` para poder comparar contra `row.statusLabel` /
`row.estimatedConnectionDate` antes del `update`. Si cambiaron, se inserta un
`project_event`:

| Campo que cambió | `event_type` | `previous_value` / `new_value` |
|---|---|---|
| `status` | `status_change` | `{ status: "..." }` |
| `estimated_connection_date` | `connection_date_change` | `{ estimatedConnectionDate: "..." }` |

### A.2 Bug encontrado de paso: `project_connection` nunca se actualiza en proyectos existentes

`processRow()` solo hace `insert` en `project_connection` en la rama de creación — la
rama de actualización (`existingProject`) nunca toca esa tabla. Si el punto de conexión,
la barra o el nivel de tensión cambian en una solicitud ya existente, hoy ese cambio se
descarta en silencio. Se corrige junto con el motor de eventos, porque son el mismo
punto de código: la rama de actualización pasa a traer también la fila de
`project_connection` existente, la compara contra `row.connectionPoint` /
`row.substationBay` / `row.voltageLevel`, hace `update` si cambió algo, y si cambió
`connection_point` o `substation_bay` (el "dónde", no el "cuándo") emite un evento nuevo:

### A.3 Nuevo tipo de evento: `connection_point_change`

El vocabulario actual de `project_event.event_type` no distingue "cambió la fecha
estimada de conexión" (`connection_date_change`, ya existe) de "cambió/se asignó la
subestación o barra de conexión" — que es lo que el usuario pidió como "avance de punto
de conexión". Migración nueva
`supabase/migrations/20260724000001_connection_point_change_event.sql`: agrega
`'connection_point_change'` al `CHECK` de `project_event.event_type`.

### A.4 SEIA match (`lib/ingestion/sources/seia/load.ts`, `saveSeiaMatch`)

Antes de hacer el `upsert` sobre `seia_record`, `saveSeiaMatch` pasa a leer el estado
previo (si `project_id` ya tenía un expediente vinculado): `seia_id` y `status`. Emite
`seia_milestone` en dos casos, buscando no generar ruido con las correcciones internas
de matching (como la del punto B más abajo):

- **Primer match** (el proyecto no tenía expediente SEIA vinculado antes): siempre.
- **Mismo expediente, cambió `ESTADO_PROYECTO`**: siempre (esto es lo que el usuario
  pidió explícitamente — "el caso que hubiera el SEIA en su estatus").
- **Expediente distinto para el mismo proyecto** (re-match a un candidato distinto,
  como el que corrimos hoy para las 17 centrales mal emparejadas): **no** genera evento
  — es una corrección de datos nuestra, no una novedad real del proyecto.

`saveSeiaMatch` necesita el `data_source_id` de `'SEIA - Servicio de Evaluación
Ambiental'` (ya sembrado en `supabase/migrations/20260720000004_seed_reference_data.sql`)
para escribir el evento — mismo patrón de lookup que ya usan `load.ts` de listado y de
Formulario.

## B. Cadencia — listado cada 24h

`scripts/sync-listado.ts` pasa de correr cada ~3 días a cada 24h (según lo que propuso
el usuario) — es la fuente de los eventos `announced` que alimentan el panel de
"nuevos" del punto C. El re-match de SEIA y el reproceso de Formulario, al ser más
lentos y no ser la fuente de "proyectos nuevos", se mantienen en un ciclo más espaciado
(a definir aparte, mismo pendiente ya anotado de "programar el ciclo completo").

Como el proyecto todavía no tiene un despliegue en producción, esto corre por ahora vía
el mecanismo de scheduling del propio agente (`ScheduleWakeup`/cron de Claude Code) —
no un cron de servidor real. Se deja anotado como limitación conocida: el día que haya
un hosting real, esto se migra a un cron de esa plataforma. No es parte del alcance de
este documento construir infraestructura de despliegue.

## C. "Proyectos futuros" — panel de nuevos en 24h

Nuevo panel en `app/(public)/proyectos-esperados/page.tsx`, arriba de la tabla: lista
los `project_event` de tipo `announced` con `occurred_at >= now() - 24h`, vía una
función nueva `getRecentlyAnnouncedProjects(client, sinceHours = 24)` en
`lib/data-access/projects.ts` (mismo shape que `RecentEvent`, sin traer los demás tipos
de evento). Si no hay proyectos nuevos en la ventana, el panel muestra un texto liviano
("Sin proyectos nuevos en las últimas 24 horas") en vez de ocultarse — mismo criterio ya
usado en el resto de la página para paneles vacíos.

## D. `/alertas` — mini-dashboard

### D.1 Toggle global "Avisarme de proyectos nuevos"

Como es un solo usuario admin (mismo modelo que `followed_project`), no hace falta una
tabla por usuario: tabla nueva `app_setting` (mismas migraciones de RLS que
`followed_project` — solo `service_role`, sin políticas para anon/authenticated):

```sql
create table app_setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
```

Con una sola fila `('notify_new_projects', 'false')`. Un switch en la página de Alertas
(`AppSettingToggle.tsx`, mismo patrón client-component que `FollowButton`) lo prende o
apaga vía una server action nueva en `watchlistActions.ts`.

### D.2 Feed de la página

`getWatchlistEvents(client, limit, includeNewProjects)` pasa a aceptar un tercer
argumento `includeNewProjects: boolean` (el valor leído de `app_setting`, después del
`limit` que ya existe): si es `true`, el feed de "Novedades recientes" se arma
con la unión de (a) eventos de los proyectos seguidos — igual que hoy — y (b) eventos
`announced` de las últimas 24h de cualquier proyecto — igual que el panel de Proyectos
futuros del punto C, mismo dato, sin duplicar lógica de consulta (se reutiliza
`getRecentlyAnnouncedProjects`).

### D.3 Lista de seguidos con "dejar de seguir"

`FollowButton` ya existe y ya soporta el toggle; hoy solo se usa en la ficha del
proyecto. Se agrega a cada fila de la lista de "Proyectos que sigues" en `/alertas`
(`getFollowedProjects` ya trae `projectId`, alcanza para renderizar el botón ahí sin
tocar la función).

### D.4 Qué dispara cada aviso (texto explicativo)

Bloque fijo en la página, arriba del feed, listando en lenguaje llano lo que el usuario
pidió dejar explícito:

> Esto te avisa cuando: cambia el estado de una solicitud que sigues, se asigna o
> cambia su punto de conexión, cambia su fecha estimada de conexión, hay novedades en su
> evaluación ambiental (SEIA) — y, si activaste el switch de arriba, cuando entra
> cualquier proyecto nuevo a Acceso Abierto.

## Fuera de alcance (explícito)

- Sin correo ni ninguna otra notificación fuera de la app — confirmado con el usuario.
- Sin cron de servidor real — corre vía scheduling del agente hasta que exista un
  despliegue en producción (fuera de alcance de este documento).
- No se generan eventos `capacity_change`, `ownership_change`, `developer_change` ni
  `delay` todavía — el usuario pidió específicamente estado, punto de conexión, fecha, y
  SEIA. El vocabulario ya soporta agregarlos después sin otra migración.
- No se toca el reproceso de Formulario ni su cadencia — sigue como está hoy.

## Testing

- `npx tsc --noEmit` limpio.
- Migraciones: correr contra la base y confirmar que no rompen filas existentes
  (`connection_point_change` es un valor nuevo, no reemplaza ninguno; `app_setting` es
  tabla nueva).
- Manual: correr `sync-listado.ts` dos veces seguidas con datos reales donde se sepa que
  algo cambió (estado, fecha, o punto de conexión de un proyecto ya cargado) y confirmar
  que aparece el `project_event` correcto; correr el re-match de SEIA sobre un proyecto
  ya matcheado sin cambios y confirmar que NO genera evento; abrir `/proyectos-esperados`
  y confirmar el panel de nuevos en 24h; abrir `/alertas`, prender/apagar el switch y
  confirmar que el feed cambia; dejar de seguir un proyecto desde la lista de Alertas y
  confirmar que desaparece de ahí y de la ficha.
