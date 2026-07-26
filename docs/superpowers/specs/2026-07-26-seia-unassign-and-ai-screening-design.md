# Admin: Quitar match SEIA + Tamizado con IA de la cola del Verificador

**Fecha:** 2026-07-26
**Estado:** Aprobado por el usuario, pendiente de plan de implementación

## Contexto

Sobre la base ya construida de `/admin` (Verificador + Editar data, ver
`docs/superpowers/specs/2026-07-25-admin-verificador-editar-data-design.md`) y del panel
de sugerencia de IA (GLM-5.2, `AiSuggestionPanel`/`aiSuggestionActions.ts`, ya validado
sobre un piloto de 40 proyectos + una prueba operacional de 20), el usuario pidió dos
mejoras:

1. Cuando el sistema asocia (automática o manualmente) un expediente SEIA equivocado a
   un proyecto, poder desvincularlo desde la misma ficha de admin.
2. Como la cola de verificación tiene miles de proyectos pendientes, poder filtrarla para
   ver solo los que la IA marca como dudosos, en vez de tener que pedir la sugerencia
   proyecto por proyecto.

Contexto técnico relevante ya existente que este diseño reutiliza:

- `saveSeiaMatch` (`lib/ingestion/sources/seia/load.ts`) ya desvincula (`project_id =
  null`) cualquier match previo distinto al nuevo candidato antes de asociar uno nuevo —
  la nueva acción de "quitar" usa exactamente ese mismo mecanismo, sin candidato nuevo.
- `getAiVerificationSuggestion` / `getGlmVerificationSuggestion`
  (`app/(public)/admin/verificador/aiSuggestionActions.ts`,
  `lib/ai/verification/glmSuggestion.ts`) ya implementan la llamada a GLM-5.2 y el
  criterio de sanity/pick — se reutilizan tal cual, tanto desde el panel on-demand como
  desde el script batch nuevo.
- `scripts/match-seia-projects.ts` es el precedente directo para el script batch de
  tamizado: mismo patrón CLI manual (`node scripts/<script>.ts [batchSize]`, sin cron),
  mismo criterio de selección (`project` filtrado por lo que aún falta procesar), mismo
  `sleep` entre llamadas para no saturar servicios externos.
- `getVerificationQueue` (`lib/data-access/projects.ts`) ya arma la lista de la cola —
  se extiende para incluir las columnas nuevas, no se reescribe.

## Parte 1 — Quitar asociación SEIA

**Decisión confirmada con el usuario:** es solo una desvinculación (`project_id = null`
en `seia_record`), no una marca permanente de "no aplica EIA/DIA". Si el proceso semanal
de re-matching (`scripts/match-seia-projects.ts`) le vuelve a sugerir algo a este
proyecto en una corrida futura, es una decisión manual aceptada — no se construye ningún
mecanismo de exclusión permanente.

Nueva función en `app/(public)/admin/projectEditActions.ts`:

```ts
export async function unassignSeiaMatch(projectId: string): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error } = await client.from("seia_record").update({ project_id: null }).eq("project_id", projectId);
    if (error) throw new Error(error.message);
    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

**UI:** en `ProjectEditPageBody` (el bloque compartido "Estado ambiental"), un botón
"Quitar" junto al `SeiaMatchModal` existente, visible solo cuando `seiaRecord` no es
null. Un clic, sin confirmación adicional (mismo criterio que ya usa `VerifyButton`: es
reversible buscando y reasociando de nuevo). Al completar, refresca la vista igual que
hace `AiSuggestionPanel.handleApply` (`router.refresh()`), y el bloque pasa a mostrar
"Sin expediente SEIA asociado todavía."

Esto aparece igual en ambas pantallas — `/admin/verificador/[id]` y
`/admin/editar-data/[id]` — porque ambas comparten `ProjectEditPageBody`.

## Parte 2 — Tamizado con IA de la cola

### Esquema

Nueva migración `supabase/migrations/20260726000000_ai_screening.sql`, 5 columnas
nullable en `project` (mismo patrón sin-default que `verified_at`):

```sql
alter table project add column if not exists ai_screened_at timestamptz;
alter table project add column if not exists ai_data_sanity text;
alter table project add column if not exists ai_data_sanity_reason text;
alter table project add column if not exists ai_seia_pick text;
alter table project add column if not exists ai_seia_pick_reason text;
```

Sin backfill: todo proyecto existente nace con estas 5 columnas en `null` (= "todavía no
tamizado"), igual que pasó con `verified_at`.

### Guardar el resultado (punto único, reusado por batch y on-demand)

Nueva función en `lib/data-access/projects.ts`:

```ts
export async function saveAiScreeningResult(
  client: SupabaseClient,
  projectId: string,
  suggestion: VerificationSuggestion,
): Promise<void> {
  const { error } = await client
    .from("project")
    .update({
      ai_screened_at: new Date().toISOString(),
      ai_data_sanity: suggestion.dataSanity,
      ai_data_sanity_reason: suggestion.dataSanityReason,
      ai_seia_pick: suggestion.seiaPick,
      ai_seia_pick_reason: suggestion.seiaPickReason,
    })
    .eq("id", projectId);
  if (error) throw new Error(`Error guardando tamizado de IA: ${error.message}`);
}
```

`getAiVerificationSuggestion` (la acción on-demand ya existente) llama a esta función
justo después de obtener la sugerencia de GLM, antes de devolver el resultado al cliente
— así toda sugerencia pedida manualmente también queda guardada, sin duplicar el punto
de escritura.

### Caché en el panel on-demand

`AiSuggestionPanel` recibe ahora el resultado ya guardado como prop inicial (leído por el
server component `ProjectEditPageBody` desde `ProjectDetail`, que se extiende con los 5
campos nuevos). Si `aiScreenedAt` no es null, el panel muestra ese resultado de
inmediato, sin llamar a GLM — el botón dice "Actualizar sugerencia" en vez de "Pedir
sugerencia de IA". Un clic siempre fuerza una llamada nueva (vía la misma acción
`getAiVerificationSuggestion`, que sobrescribe el resultado guardado).

### Script batch

Nuevo `scripts/screen-verification-queue.ts`, calcado de
`scripts/match-seia-projects.ts`:

- CLI: `node scripts/screen-verification-queue.ts [batchSize=50]`.
- Selecciona proyectos con `verified_at is null` y `ai_screened_at is null`, hasta
  `batchSize`.
- Por cada uno: mismos pasos que `getAiVerificationSuggestion` (candidatos SEIA vía
  `searchSeiaByName(distinctiveTokens(name))`, sugerencia vía
  `getGlmVerificationSuggestion`), pero llamado directo con el `service_role` client (sin
  pasar por la acción `"use server"`, que requiere sesión de request) — mismo patrón que
  `match-seia-projects.ts` llama a `saveSeiaMatch` directo.
- Guarda con `saveAiScreeningResult`.
- `sleep` entre llamadas (mismo valor que ya usa `match-seia-projects.ts`, 400ms) para no
  saturar la API de SEIA ni el rate limit de GLM.
- Log de progreso por consola: proyecto, sanity, pick (si hay), tiempo — mismo formato
  que ya se usó para `docs/glm-operational-check-2026-07-26.md`.

Se corre manualmente cuando el usuario quiera avanzar el backlog (no hay cron en este
repo — se confirma que este es el patrón aceptado, igual que el de SEIA).

### Filtro "Solo dudosos" en `/admin/verificador`

`getVerificationQueue` se extiende para incluir `aiScreenedAt`, `aiDataSanity`,
`aiSeiaPick` en `VerificationQueueItem`. La página agrega:

- Un toggle "Solo dudosos" (`?dudosos=1`), que filtra donde `ai_data_sanity =
  'sospechoso'` OR `ai_seia_pick is not null` (confirmado con el usuario: un candidato
  SEIA sugerido también cuenta como "vale la pena revisar", aunque los datos estén bien).
- Un contador "X de Y tamizados, Z dudosos" sobre el total pendiente, para que el admin
  vea cuánto llevas del backlog sin tener que correr el script para saberlo.
- Un badge chico (⚠️) en la fila de la tabla para las filas dudosas, visible **aunque el
  filtro esté apagado** — no solo cuando se activa "Solo dudosos".

## Fuera de alcance (explícito)

- Sin marca permanente de "no aplica EIA/DIA" — la desvinculación es simple, sin
  protección contra que el re-matching semanal la deshaga.
- Sin re-tamizado automático si los datos del proyecto cambian después de tamizado una
  vez — para volver a tamizar hay que usar "Actualizar sugerencia" manualmente en el
  panel, o limpiar `ai_screened_at` a mano.
- Sin cron ni programación automática del script batch — se sigue corriendo a mano, igual
  que el de SEIA.
- Sin cambios al criterio de sanity/pick de GLM en sí (`glmSuggestion.ts`) — se reutiliza
  el prompt ya validado tal cual.

## Testing

- `npx tsc --noEmit` y `npm run lint` limpios.
- Migración: confirmar que corre sin romper filas existentes (5 columnas nuevas,
  nullable, sin default).
- Manual — Parte 1: en un proyecto con match SEIA asociado, click "Quitar", confirmar que
  el bloque pasa a "Sin expediente SEIA asociado todavía" y que persiste tras recargar.
- Manual — Parte 2: correr `node scripts/screen-verification-queue.ts 10` contra la base
  real, confirmar que tamiza 10 proyectos y actualiza sus columnas `ai_*`; abrir uno de
  esos proyectos en el Verificador y confirmar que el panel muestra el resultado guardado
  sin pedir uno nuevo; activar "Solo dudosos" y confirmar que la lista se filtra
  correctamente; abrir un proyecto no tamizado y confirmar que no aparece con el filtro
  activo.
