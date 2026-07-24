# Motor de eventos, panel de nuevos 24h, y dashboard de Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Generar `project_event` en cada sync (listado, SEIA) para status/fecha/punto de
conexión/SEIA, mostrar los proyectos nuevos de las últimas 24h en Proyectos futuros, y
ampliar `/alertas` a un mini-dashboard con toggle de "avisarme de nuevos" y "dejar de
seguir".

**Architecture:** Se agrega diffing (valor previo vs. nuevo) justo antes de cada
`update` que ya existe en los loaders de ingesta — no hay tabla ni pipeline nuevo, solo
lectura del estado previo + `insert` en `project_event` cuando cambia algo. Las dos
piezas de UI leen ese mismo `project_event` con distintos filtros.

**Tech Stack:** Next.js 16 Server Components, Supabase, sin framework de tests —
verificación con `npx tsc --noEmit` + scripts `tsx` puntuales contra datos reales.

## Global Constraints

- Sin correo ni notificación fuera de la app (confirmado con el usuario).
- No se generan eventos `capacity_change`/`ownership_change`/`developer_change`/`delay` —
  solo status, fecha de conexión, punto de conexión, y SEIA.
- Reutilizar componentes/patrones existentes (`Panel`, `FollowButton`, `ActivityTimeline`)
  en vez de crear nuevos donde uno ya sirve.
- Un solo usuario admin — sin modelar nada por usuario (`app_setting` es global, como
  `followed_project`).

---

### Task 1: Motor de eventos — listado sync

**Files:**
- Create: `supabase/migrations/20260724000001_connection_point_change_event.sql`
- Modify: `lib/ingestion/sources/energia-abierta/listado/load.ts:160-198` (rama `existingProject`)

**Interfaces:**
- Produce: eventos `status_change`, `connection_date_change`, `connection_point_change`
  en `project_event` (columnas ya existentes: `previous_value`, `new_value` jsonb).

**Migración** (agrega un valor al `CHECK` existente, sin tocar los demás):

```sql
alter table project_event drop constraint project_event_event_type_check;
alter table project_event add constraint project_event_event_type_check
  check (event_type in (
    'announced', 'capacity_change', 'ownership_change', 'developer_change',
    'connection_date_change', 'construction_date_change', 'status_change',
    'seia_milestone', 'delay', 'other', 'connection_point_change'
  ));
```

**Cambio en `load.ts`:** la consulta de `existingProject` (línea ~160) hoy solo trae
`id`. Pasa a traer también `status, estimated_connection_date`, y se agrega una segunda
consulta a `project_connection` (`connection_point, substation_bay, voltage_level`) para
el mismo `existingProject.id`. **Bug de paso:** hoy la rama de actualización nunca
toca `project_connection` — un cambio real de punto de conexión en una solicitud ya
cargada se pierde en silencio. Se corrige acá mismo, agregando el `update`/`insert`
correspondiente (hoy solo se inserta en la rama de creación).

Reemplazar el bloque `if (existingProject) { ... }` (líneas 188-198) por:

```ts
if (existingProject) {
  if (existingProject.status !== row.statusLabel) {
    await client.from("project_event").insert({
      project_id: existingProject.id, event_type: "status_change",
      occurred_at: new Date().toISOString(),
      previous_value: JSON.stringify({ status: existingProject.status }),
      new_value: JSON.stringify({ status: row.statusLabel }),
      data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
      description: `Cambió el estado de la solicitud: "${existingProject.status}" → "${row.statusLabel}"`,
    });
  }
  if (existingProject.estimated_connection_date !== row.estimatedConnectionDate) {
    await client.from("project_event").insert({
      project_id: existingProject.id, event_type: "connection_date_change",
      occurred_at: new Date().toISOString(),
      previous_value: JSON.stringify({ estimatedConnectionDate: existingProject.estimated_connection_date }),
      new_value: JSON.stringify({ estimatedConnectionDate: row.estimatedConnectionDate }),
      data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
      description: `Cambió la fecha estimada de conexión`,
    });
  }

  const { data: existingConnection } = await client
    .from("project_connection")
    .select("connection_point, substation_bay, voltage_level")
    .eq("project_id", existingProject.id)
    .maybeSingle();
  if (existingConnection) {
    const pointChanged =
      existingConnection.connection_point !== row.connectionPoint ||
      existingConnection.substation_bay !== row.substationBay;
    if (pointChanged) {
      await client.from("project_event").insert({
        project_id: existingProject.id, event_type: "connection_point_change",
        occurred_at: new Date().toISOString(),
        previous_value: JSON.stringify({ connectionPoint: existingConnection.connection_point, substationBay: existingConnection.substation_bay }),
        new_value: JSON.stringify({ connectionPoint: row.connectionPoint, substationBay: row.substationBay }),
        data_source_id: dataSourceId, confidence_level: CONFIDENCE_PUBLIC,
        description: `Cambió el punto de conexión`,
      });
    }
    if (pointChanged || existingConnection.voltage_level !== row.voltageLevel) {
      await client.from("project_connection").update({
        connection_point: row.connectionPoint, substation_bay: row.substationBay, voltage_level: row.voltageLevel,
      }).eq("project_id", existingProject.id);
    }
  }

  const { error: updateError } = await client.from("project").update(projectFields).eq("id", existingProject.id);
  if (updateError) throw new Error(`Error actualizando proyecto '${row.projectName}' (${row.externalId}): ${updateError.message}`);
  summary.projectsUpdated += 1;
  return;
}
```

Y cambiar el `select` de `existingProject` (línea ~160-165) a
`.select("id, status, estimated_connection_date")`.

**Verificar:** `npx tsc --noEmit` limpio. Correr `npx tsx scripts/sync-listado.ts` dos
veces seguidas contra producción no debería generar eventos la segunda vez si nada
cambió (confirmar con una consulta a `project_event order by recorded_at desc limit 10`).

**Commit** tras verificar.

---

### Task 2: Motor de eventos — SEIA match

**Files:**
- Modify: `lib/ingestion/sources/seia/load.ts`

**Interfaces:**
- Consume: `GENERATION_TYPE_CODE` no aplica acá; usa `SeiaMatchResult` de `match.ts`
  (ya existe, sin cambios).
- Produce: eventos `seia_milestone` en `project_event`.

En `saveSeiaMatch`, antes del `upsert`, leer el estado previo y el `data_source_id`:

```ts
async function getSeiaDataSourceId(client: SupabaseClient): Promise<string> {
  const { data } = await client.from("data_source").select("id").eq("name", "SEIA - Servicio de Evaluación Ambiental").single();
  if (!data) throw new Error("No se encontró el data_source de SEIA");
  return data.id as string;
}
```

Y al inicio de `saveSeiaMatch`, antes del `update` que desvincula otros expedientes:

```ts
const { data: previous } = await client.from("seia_record").select("seia_id, status").eq("project_id", projectId).maybeSingle();
```

Después del `upsert` exitoso, agregar:

```ts
const isFirstMatch = !previous;
const sameRecordStatusChanged = previous?.seia_id === candidate.EXPEDIENTE_ID && previous.status !== candidate.ESTADO_PROYECTO;
if (isFirstMatch || sameRecordStatusChanged) {
  await client.from("project_event").insert({
    project_id: projectId, event_type: "seia_milestone",
    occurred_at: new Date().toISOString(),
    previous_value: previous ? JSON.stringify({ status: previous.status }) : null,
    new_value: JSON.stringify({ status: candidate.ESTADO_PROYECTO, expediente: candidate.EXPEDIENTE_NOMBRE }),
    data_source_id: await getSeiaDataSourceId(client), confidence_level: "PUBLICO",
    description: isFirstMatch
      ? `Expediente SEIA encontrado: "${candidate.EXPEDIENTE_NOMBRE}" (${candidate.ESTADO_PROYECTO})`
      : `Cambió el estado SEIA: "${previous?.status}" → "${candidate.ESTADO_PROYECTO}"`,
  });
}
```

**No** generar evento cuando `previous.seia_id !== candidate.EXPEDIENTE_ID` (re-match a
un expediente distinto para el mismo proyecto) — es una corrección de datos, no una
novedad real (ver spec, sección A.4).

**Verificar:** `npx tsc --noEmit` limpio. Correr
`npx tsx scripts/match-seia-projects.ts 5` (o similar) y confirmar en logs/DB que no se
genera `seia_milestone` para proyectos sin cambios reales, y sí para uno nuevo.

**Commit** tras verificar.

---

### Task 3: Panel de "proyectos nuevos" en Proyectos futuros

**Files:**
- Modify: `lib/data-access/projects.ts` (agregar función, junto a `getRecentProjectEvents` ~línea 359)
- Modify: `app/(public)/proyectos-esperados/page.tsx`

**Interfaces:**
- Produce: `getRecentlyAnnouncedProjects(client: SupabaseClient, sinceHours = 24): Promise<RecentEvent[]>`
  (mismo tipo `RecentEvent` que ya existe).
- Consume: tipo `RecentEvent`, componente `ActivityTimeline`, `Panel` (ya existen, sin cambios).

En `lib/data-access/projects.ts`, junto a `getRecentProjectEvents`:

```ts
export async function getRecentlyAnnouncedProjects(client: SupabaseClient, sinceHours = 24): Promise<RecentEvent[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await client
    .from("project_event")
    .select("id, project_id, event_type, occurred_at, description, project:project_id(name)")
    .eq("event_type", "announced")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(`Error obteniendo proyectos nuevos: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    projectId: row.project_id as string,
    projectName: (row.project as unknown as { name: string } | null)?.name ?? "Proyecto",
    eventType: row.event_type as string,
    occurredAt: row.occurred_at as string,
    description: row.description as string | null,
  }));
}
```

En `app/(public)/proyectos-esperados/page.tsx`: importar `getRecentlyAnnouncedProjects`
desde `@/lib/data-access/projects` (mismo import que ya trae `getRecentProjectEvents`).
En el `Promise.all` (línea ~110-134), agregar `newProjects` a ambos arreglos:

```ts
const [
  result, mapData, funnel, calendar, scopeTotals, seiaStatusByProjectId,
  ageBenchmarks, solicitudes7d, solicitudes30d, recentEvents, newProjects, admin,
] = await Promise.all([
  listProjects(client, { ...filters, projectIds: etapaProjectIds }, page, PAGE_SIZE),
  getProjectsForMap(client, { technologyCodes, namePatterns, search }),
  getPipelineFunnel(client), getConnectionCalendar(client), getPipelineScopeTotals(client),
  getSeiaStatusesForUpcomingProjects(client), getRequestAgeBenchmarks(client),
  getRecentSolicitudesCount(client, 7), getRecentSolicitudesCount(client, 30),
  getRecentProjectEvents(client, 10), getRecentlyAnnouncedProjects(client, 24), isAdmin(),
]);
```

Y agregar un nuevo `<Panel>` dentro de `<AnalysisDrawer>` (línea ~350, justo después del
Panel "Actividad reciente" que ya existe — no lo reemplaza, es un panel nuevo y distinto,
acotado solo a proyectos nuevos):

```tsx
<Panel className="flex flex-col gap-4">
  <div>
    <h2 className="text-sm font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
      Proyectos nuevos (últimas 24h)
    </h2>
    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
      Solicitudes que entraron a Acceso Abierto en las últimas 24 horas.
    </p>
  </div>
  <ActivityTimeline events={newProjects} />
</Panel>
```

**Verificar:** `npx tsc --noEmit` limpio; con el dev server corriendo, abrir
`/proyectos-esperados`, expandir "Análisis" y confirmar que el panel nuevo aparece
(vacío o con datos según haya habido sync reciente).

**Commit** tras verificar.

---

### Task 4: Dashboard de Alertas — toggle global + dejar de seguir + eventos reales

**Files:**
- Create: `supabase/migrations/20260724000002_app_setting.sql`
- Create: `app/(public)/components/AppSettingToggle.tsx`
- Modify: `lib/data-access/watchlist.ts`
- Modify: `app/(public)/watchlistActions.ts`
- Modify: `app/(public)/alertas/page.tsx`

**Interfaces:**
- Consume: `getRecentlyAnnouncedProjects` (Task 3), `FollowButton` (ya existe, sin cambios).
- Produce: `getAppSetting(client, key): Promise<boolean>`, `setAppSetting(client, key, value): Promise<void>`,
  `getWatchlistEvents(client, limit, includeNewProjects): Promise<WatchlistEvent[]>` (firma ampliada).

**Migración:**

```sql
create table app_setting (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table app_setting enable row level security;
insert into app_setting (key, value) values ('notify_new_projects', 'false');
```

**`lib/data-access/watchlist.ts`** — agregar:

```ts
export async function getAppSetting(client: SupabaseClient, key: string): Promise<boolean> {
  const { data } = await client.from("app_setting").select("value").eq("key", key).maybeSingle();
  return data?.value === true;
}

export async function setAppSetting(client: SupabaseClient, key: string, value: boolean): Promise<void> {
  const { error } = await client.from("app_setting").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Error guardando configuración '${key}': ${error.message}`);
}
```

Y cambiar la firma de `getWatchlistEvents` (agrega un tercer parámetro, después del
`limit` existente):

```ts
function mapWatchlistEvent(r: Record<string, unknown>): WatchlistEvent {
  return {
    id: r.id as string, projectId: r.project_id as string,
    projectName: (r.project as unknown as { name: string } | null)?.name ?? "Proyecto",
    eventType: r.event_type as string, occurredAt: r.occurred_at as string, description: r.description as string | null,
  };
}

export async function getWatchlistEvents(client: SupabaseClient, limit = 30, includeNewProjects = false): Promise<WatchlistEvent[]> {
  const { data: followed } = await client.from("followed_project").select("project_id");
  const projectIds = (followed ?? []).map((r) => r.project_id as string);

  const selectCols = "id, project_id, event_type, occurred_at, description, project:project_id(name)";
  const [followedResult, newProjectsResult] = await Promise.all([
    projectIds.length > 0
      ? client.from("project_event").select(selectCols).in("project_id", projectIds).order("occurred_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [], error: null }),
    includeNewProjects
      ? client.from("project_event").select(selectCols).eq("event_type", "announced").order("occurred_at", { ascending: false }).limit(limit)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (followedResult.error) throw new Error(`Error obteniendo eventos de seguimiento: ${followedResult.error.message}`);
  if (newProjectsResult.error) throw new Error(`Error obteniendo proyectos nuevos: ${newProjectsResult.error.message}`);

  const merged = new Map<string, WatchlistEvent>();
  for (const row of [...(followedResult.data ?? []), ...(newProjectsResult.data ?? [])]) {
    const event = mapWatchlistEvent(row as Record<string, unknown>);
    merged.set(event.id, event);
  }
  return [...merged.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
}
```

**`app/(public)/components/AppSettingToggle.tsx`** (mismo patrón `useState`/`useTransition` que `FollowButton.tsx`):

```tsx
"use client";
import { useState, useTransition } from "react";
import { toggleAppSetting } from "../watchlistActions";

export function AppSettingToggle({ settingKey, initiallyOn, label }: { settingKey: string; initiallyOn: boolean; label: string }) {
  const [on, setOn] = useState(initiallyOn);
  const [pending, startTransition] = useTransition();
  function handleToggle() {
    const next = !on;
    startTransition(async () => {
      const result = await toggleAppSetting(settingKey, next);
      if (result.success) setOn(next);
    });
  }
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
      <input type="checkbox" checked={on} disabled={pending} onChange={handleToggle} className="h-4 w-4" />
      {label}
    </label>
  );
}
```

**`app/(public)/watchlistActions.ts`** — agregar:

```ts
import { getAppSetting, setAppSetting } from "@/lib/data-access/watchlist";

export async function toggleAppSetting(key: string, value: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) return { success: false, error: "Debes iniciar sesión como administrador." };
  try {
    await setAppSetting(createSupabaseServiceClient(), key, value);
    revalidatePath("/alertas");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

**`app/(public)/alertas/page.tsx`** — cambios:
1. Importar `getAppSetting`, `AppSettingToggle`, `FollowButton`.
2. Antes del `Promise.all` existente, leer `const notifyNewProjects = await getAppSetting(client, "notify_new_projects")`.
3. Cambiar la llamada a `getWatchlistEvents(client, 50)` por `getWatchlistEvents(client, 50, notifyNewProjects)`.
4. Agregar `<AppSettingToggle settingKey="notify_new_projects" initiallyOn={notifyNewProjects} label="Avisarme de proyectos nuevos" />` justo debajo del `<h1>`.
5. En cada `<li>` de la lista de "Proyectos que sigues" (línea ~64-71), agregar `<FollowButton projectId={f.projectId} initiallyFollowed={true} />` junto al `ThermalStatusBar`.
6. Agregar, antes del Panel de "Novedades recientes", un bloque fijo:

```tsx
<p className="text-sm text-neutral-500 dark:text-neutral-400">
  Esto te avisa cuando: cambia el estado de una solicitud que sigues, se asigna o cambia
  su punto de conexión, cambia su fecha estimada de conexión, o hay novedades en su
  evaluación ambiental (SEIA) — y, si activaste el switch de arriba, cuando entra
  cualquier proyecto nuevo a Acceso Abierto.
</p>
```

**Verificar:** `npx tsc --noEmit` limpio; con el dev server corriendo, abrir `/alertas`
como admin, prender/apagar el switch y confirmar que persiste al recargar; dejar de
seguir un proyecto desde la lista y confirmar que desaparece.

**Commit** tras verificar.

---

## Después del plan

Task 3/4 del spec original (cadencia de sync cada 24h) no es una tarea de código — es
programar la ejecución periódica de `scripts/sync-listado.ts`. Se hace aparte, fuera de
subagent-driven-development, una vez que las 4 tareas de arriba estén mergeadas.
