# Quitar match SEIA + Tamizado con IA de la cola — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Quitar" action to unassign a wrong SEIA match from the shared
admin ficha, and a background AI-screening pipeline (reusing the already-validated
GLM-5.2 suggestion) so `/admin/verificador` can filter its queue down to the projects
worth a closer look.

**Architecture:** `unassignSeiaMatch` (new server action, `app/(public)/admin/projectEditActions.ts`)
mirrors the existing unlink-before-relink step already inside `saveSeiaMatch`, exposed
via a new `UnassignSeiaButton` client component wired into the shared `ProjectEditPageBody`.
Five new nullable columns on `project` (`ai_screened_at`, `ai_data_sanity`,
`ai_data_sanity_reason`, `ai_seia_pick`, `ai_seia_pick_reason`) persist GLM-5.2 verdicts
from two producers — the existing on-demand action `getAiVerificationSuggestion` and a new
batch script `scripts/screen-verification-queue.ts` (same manual-CLI pattern as
`scripts/match-seia-projects.ts`) — through one shared write function,
`saveAiScreeningResult`. The Verificador queue reads the persisted columns to filter,
badge, and count without ever calling GLM itself.

**Tech Stack:** Next.js 16 (App Router, React Server Components), TypeScript (strict),
Supabase (Postgres + PostgREST via `@supabase/supabase-js`), Tailwind CSS, lucide-react
icons, `tsx` for one-off scripts.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-seia-unassign-and-ai-screening-design.md` —
  every requirement below traces back to it.
- "Quitar" is a plain unlink (`seia_record.project_id = null`), never a permanent "no
  aplica EIA/DIA" flag — confirmed with the user. A future run of
  `scripts/match-seia-projects.ts` may re-suggest a match to the same project; that is
  accepted, not a bug.
- "Dudoso" = `ai_data_sanity = 'sospechoso'` OR `ai_seia_pick is not null` — confirmed
  with the user (a suggested SEIA candidate counts as worth reviewing even when the data
  itself is fine).
- No cron, no automatic scheduling — the screening script is run manually, exactly like
  the existing SEIA matcher.
- Single admin model: every new write path checks `isAdmin()` at the top and returns
  `{ success: false, error: "..." }` — no client-supplied admin flag, no "who" field
  (there is only one admin).
- **No test runner exists in this repo.** Every task's verification step is
  `npx tsc --noEmit` + `npm run lint`, plus a concrete manual check (dev server, or a
  one-off `node -e` / `npx tsx` check) — matching how every prior spec in
  `docs/superpowers/specs/` was verified. Do not introduce a test framework.
- Follow existing formatting conventions exactly: double quotes, Tailwind utility classes
  matching neutral-50..950 + `dark:` variants already used throughout
  `app/(public)/components/` and `app/(public)/admin/`, Spanish UI copy.

---

### Task 1: Database columns + data-access functions for AI screening

**Files:**
- Create: `supabase/migrations/20260726000000_ai_screening.sql`
- Modify: `lib/data-access/projects.ts` (add `ai*` fields to `ProjectDetail`/`getProjectById`
  and `VerificationQueueItem`/`getVerificationQueue`; add `saveAiScreeningResult`,
  `getDoubtfulProjects`, `getVerificationScreeningStats`)

**Interfaces:**
- Produces: `ProjectDetail.aiScreenedAt: string | null`, `.aiDataSanity: "ok" | "sospechoso" | null`,
  `.aiDataSanityReason: string | null`, `.aiSeiaPick: string | null`, `.aiSeiaPickReason: string | null`
- Produces: `VerificationQueueItem.aiScreenedAt: string | null`, `.aiDataSanity: "ok" | "sospechoso" | null`,
  `.aiSeiaPick: string | null`
- Produces: `saveAiScreeningResult(client: SupabaseClient, projectId: string, suggestion: VerificationSuggestion): Promise<void>`
- Produces: `getDoubtfulProjects(client: SupabaseClient, limit?: number): Promise<VerificationQueueItem[]>`
- Produces: `getVerificationScreeningStats(client: SupabaseClient): Promise<{ totalPending: number; screened: number; doubtful: number }>`
- Consumes: `VerificationSuggestion` type from `@/lib/ai/verification/glmSuggestion` (already exists, unchanged)

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260726000000_ai_screening.sql
-- Tamizado con IA (GLM-5.2) de la cola del Verificador — ver
-- docs/superpowers/specs/2026-07-26-seia-unassign-and-ai-screening-design.md.
-- null en ai_screened_at = todavía no tamizado.
alter table project add column if not exists ai_screened_at timestamptz;
alter table project add column if not exists ai_data_sanity text;
alter table project add column if not exists ai_data_sanity_reason text;
alter table project add column if not exists ai_seia_pick text;
alter table project add column if not exists ai_seia_pick_reason text;
```

- [ ] **Step 2: Apply the migration against the real database**

Run: `node scripts/run-migrations.mjs`
Expected: output lists `20260726000000_ai_screening.sql` as applied (or already-applied
if run twice), no errors.

- [ ] **Step 3: Add an import for `VerificationSuggestion` at the top of `lib/data-access/projects.ts`**

Add after the existing imports (after the `PMGD_CAPACITY_THRESHOLD_MW` import, around
line 4):

```ts
import type { VerificationSuggestion } from "@/lib/ai/verification/glmSuggestion";
```

- [ ] **Step 4: Extend `ProjectDetail` and `getProjectById`**

In `lib/data-access/projects.ts`, the `ProjectDetail` interface (around line 249) gains 5
fields after `verifiedAt`:

```ts
export interface ProjectDetail extends ProjectListItem {
  externalReference: string | null;
  nup: string | null;
  connectionPoint: string | null;
  voltageLevel: string | null;
  requestType: string | null;
  countryCode: string | null;
  developerCompanyId: string | null;
  technologyCode: string | null;
  developerCompanyRut: string | null;
  developerCompanyAddress: string | null;
  verifiedAt: string | null;
  aiScreenedAt: string | null;
  aiDataSanity: "ok" | "sospechoso" | null;
  aiDataSanityReason: string | null;
  aiSeiaPick: string | null;
  aiSeiaPickReason: string | null;
}
```

In `getProjectById`, change the `.select(...)` string so `verified_at` is followed by the
5 new columns (insert right after `verified_at,` and before `developer_company_id,`):

```ts
  const { data, error } = await client
    .from("project")
    .select(
      "id, name, internal_code, external_reference, nup, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, verified_at, ai_screened_at, ai_data_sanity, ai_data_sanity_reason, ai_seia_pick, ai_seia_pick_reason, developer_company_id, technology:technology_id(name, code), location:location_id(comuna, region:region_id(name)), country:country_id(code), developer:developer_company_id(name, rut, legal_address), spv:spv_id(name), project_connection(connection_point, voltage_level, request_type)",
    )
    .eq("id", id)
    .maybeSingle();
```

Add to the inline row type `r` (after `verified_at: string | null;`):

```ts
    verified_at: string | null;
    ai_screened_at: string | null;
    ai_data_sanity: string | null;
    ai_data_sanity_reason: string | null;
    ai_seia_pick: string | null;
    ai_seia_pick_reason: string | null;
```

Add to the returned object (after `verifiedAt: r.verified_at,`):

```ts
    verifiedAt: r.verified_at,
    aiScreenedAt: r.ai_screened_at,
    aiDataSanity: r.ai_data_sanity as "ok" | "sospechoso" | null,
    aiDataSanityReason: r.ai_data_sanity_reason,
    aiSeiaPick: r.ai_seia_pick,
    aiSeiaPickReason: r.ai_seia_pick_reason,
```

- [ ] **Step 5: Extend `VerificationQueueItem` and `getVerificationQueue`**

Change the interface (around line 338):

```ts
export interface VerificationQueueItem {
  id: string;
  name: string;
  comuna: string | null;
  region: string | null;
  capacityMw: number | null;
  estimatedConnectionDate: string | null;
  status: string | null;
  aiScreenedAt: string | null;
  aiDataSanity: "ok" | "sospechoso" | null;
  aiSeiaPick: string | null;
}
```

In `getVerificationQueue`, change `selectClause` to:

```ts
  const selectClause =
    "id, name, capacity_mw, estimated_connection_date, status, ai_screened_at, ai_data_sanity, ai_seia_pick, location:location_id(comuna, region:region_id(name))";
```

Add to the inline `Row` type (after `status: string | null;`):

```ts
    ai_screened_at: string | null;
    ai_data_sanity: string | null;
    ai_seia_pick: string | null;
```

Add to the final `.map(...)` (after `status: row.status,`):

```ts
    status: row.status,
    aiScreenedAt: row.ai_screened_at,
    aiDataSanity: row.ai_data_sanity as "ok" | "sospechoso" | null,
    aiSeiaPick: row.ai_seia_pick,
```

- [ ] **Step 6: Add `saveAiScreeningResult`, `getDoubtfulProjects`, `getVerificationScreeningStats`**

Append these 3 functions right after `countUnverifiedProjects` (before the
`ProjectTimelineEntry` interface):

```ts
/**
 * Persiste el resultado de una sugerencia de IA — llamado tanto por el botón on-demand
 * del Verificador (getAiVerificationSuggestion) como por scripts/screen-verification-queue.ts,
 * así ambos caminos alimentan la misma caché sin duplicar el punto de escritura.
 */
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

/**
 * Subconjunto de la cola marcado como dudoso por el tamizado de IA: sanity sospechoso, o
 * un candidato SEIA sugerido (confirmado con el usuario: vale la pena revisar aunque los
 * datos estén bien). Proyectos sin tamizar (ai_screened_at null) no aparecen acá.
 */
export async function getDoubtfulProjects(client: SupabaseClient, limit = 100): Promise<VerificationQueueItem[]> {
  const selectClause =
    "id, name, capacity_mw, estimated_connection_date, status, ai_screened_at, ai_data_sanity, ai_seia_pick, location:location_id(comuna, region:region_id(name))";

  const { data, error } = await client
    .from("project")
    .select(selectClause)
    .is("verified_at", null)
    .or("ai_data_sanity.eq.sospechoso,ai_seia_pick.not.is.null")
    .order("ai_screened_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Error obteniendo proyectos dudosos: ${error.message}`);

  type Row = {
    id: string;
    name: string;
    capacity_mw: number | null;
    estimated_connection_date: string | null;
    status: string | null;
    ai_screened_at: string | null;
    ai_data_sanity: string | null;
    ai_seia_pick: string | null;
    location: { comuna: string | null; region: { name: string } | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    name: row.name,
    comuna: row.location?.comuna ?? null,
    region: row.location?.region?.name ?? null,
    capacityMw: row.capacity_mw,
    estimatedConnectionDate: row.estimated_connection_date,
    status: row.status,
    aiScreenedAt: row.ai_screened_at,
    aiDataSanity: row.ai_data_sanity as "ok" | "sospechoso" | null,
    aiSeiaPick: row.ai_seia_pick,
  }));
}

export interface VerificationScreeningStats {
  totalPending: number;
  screened: number;
  doubtful: number;
}

/** Estadísticas de avance del tamizado de IA — para el contador de /admin/verificador. */
export async function getVerificationScreeningStats(client: SupabaseClient): Promise<VerificationScreeningStats> {
  const [{ count: totalPending, error: e1 }, { count: screened, error: e2 }, { count: doubtful, error: e3 }] =
    await Promise.all([
      client.from("project").select("id", { count: "exact", head: true }).is("verified_at", null),
      client
        .from("project")
        .select("id", { count: "exact", head: true })
        .is("verified_at", null)
        .not("ai_screened_at", "is", null),
      client
        .from("project")
        .select("id", { count: "exact", head: true })
        .is("verified_at", null)
        .or("ai_data_sanity.eq.sospechoso,ai_seia_pick.not.is.null"),
    ]);
  if (e1) throw new Error(`Error contando estadísticas de tamizado: ${e1.message}`);
  if (e2) throw new Error(`Error contando estadísticas de tamizado: ${e2.message}`);
  if (e3) throw new Error(`Error contando estadísticas de tamizado: ${e3.message}`);
  return { totalPending: totalPending ?? 0, screened: screened ?? 0, doubtful: doubtful ?? 0 };
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 8: Manual check against the real database**

Run:
```
node -e "require('dotenv').config({path:'.env.local'}); const {createClient}=require('@supabase/supabase-js'); const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); c.from('project').select('id',{count:'exact',head:true}).not('ai_screened_at','is',null).then(r => console.log('ya tamizados:', r.count, 'error:', r.error))"
```
Expected: prints `ya tamizados: 0 error: null` (columns exist, nothing screened yet, no
error).

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260726000000_ai_screening.sql lib/data-access/projects.ts
git commit -m "Add ai_screened_at + screening columns and read/write functions"
```

---

### Task 2: Quitar match SEIA (unassign action + button)

**Files:**
- Modify: `app/(public)/admin/projectEditActions.ts` (add `unassignSeiaMatch`)
- Create: `app/(public)/admin/components/UnassignSeiaButton.tsx`
- Modify: `app/(public)/admin/components/ProjectEditPageBody.tsx` (render the button next
  to `SeiaMatchModal`)

**Interfaces:**
- Consumes: `isAdmin()` from `@/lib/auth/session`; `createSupabaseServiceClient()` from
  `@/lib/data-access/supabase-service-client` (both already imported in
  `projectEditActions.ts`)
- Produces: `unassignSeiaMatch(projectId: string): Promise<{ success: boolean; error?: string }>`
- Produces: `UnassignSeiaButton({ projectId }: { projectId: string })` — client component

- [ ] **Step 1: Add `unassignSeiaMatch` to `projectEditActions.ts`**

Append at the end of `app/(public)/admin/projectEditActions.ts`:

```ts
/**
 * Desvincula el expediente SEIA asociado a este proyecto (deja `project_id` en null en
 * `seia_record`) — mismo mecanismo que ya usa saveSeiaMatch para soltar un match previo
 * distinto antes de asociar uno nuevo, aquí sin candidato nuevo. Es solo una
 * desvinculación, no una marca de "no aplica EIA/DIA": una corrida futura de
 * scripts/match-seia-projects.ts podría volver a sugerirle algo a este proyecto
 * (decisión confirmada con el usuario, ver el spec de esta feature).
 */
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

- [ ] **Step 2: Write `UnassignSeiaButton`**

```tsx
// app/(public)/admin/components/UnassignSeiaButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unassignSeiaMatch } from "../projectEditActions";

/** Botón de un clic para desvincular un match SEIA equivocado — visible solo cuando ya hay un expediente asociado. */
export function UnassignSeiaButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await unassignSeiaMatch(projectId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? "No se pudo desvincular.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="print:hidden text-xs font-medium text-neutral-500 underline underline-offset-2 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-neutral-200"
      >
        {pending ? "Quitando…" : "Quitar"}
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `ProjectEditPageBody`**

Replace the full contents of `app/(public)/admin/components/ProjectEditPageBody.tsx`
with:

```tsx
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectionStatuses } from "@/lib/data-access/connectionStatuses";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import type { ProjectDetail } from "@/lib/data-access/projects";
import { ProjectEditForm } from "./ProjectEditForm";
import { UnassignSeiaButton } from "./UnassignSeiaButton";
import { SeiaMatchModal } from "../../proyectos/[id]/SeiaMatchModal";
import { SeiaStatusCard } from "../../components/SeiaStatusCard";

/** Cuerpo compartido de las pantallas de edición de admin (Verificador y Editar data) — el único que cambia entre ellas es el encabezado. */
export async function ProjectEditPageBody({ client, project }: { client: SupabaseClient; project: ProjectDetail }) {
  const [connectionStatuses, seiaRecord] = await Promise.all([
    getConnectionStatuses(client),
    getSeiaRecordForProject(client, project.id),
  ]);

  return (
    <>
      <ProjectEditForm project={project} connectionStatusOptions={connectionStatuses.map((s) => s.label)} />
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-neutral-500 uppercase dark:text-neutral-400">
            Estado ambiental
          </h2>
          <div className="flex items-center gap-3">
            <SeiaMatchModal projectId={project.id} hasExistingMatch={!!seiaRecord} isAdmin />
            {seiaRecord && <UnassignSeiaButton projectId={project.id} />}
          </div>
        </div>
        <div className="mt-3">
          {seiaRecord ? (
            <SeiaStatusCard record={seiaRecord} />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin expediente SEIA asociado todavía.</p>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual check with the dev server**

Run: `npm run dev`, logged in as admin:
1. Open a project that has a SEIA match (in `/admin/verificador/[id]` or
   `/admin/editar-data/[id]`) → confirm a "Quitar" link appears next to "Corregir
   asociación SEIA".
2. Click "Quitar" → confirm the block changes to "Sin expediente SEIA asociado todavía."
   and the "Quitar" link disappears (no match left to remove).
3. Reload the page → confirm the change persisted (no match reappears).
4. Open a project with no SEIA match → confirm no "Quitar" link is rendered.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/admin/projectEditActions.ts" "app/(public)/admin/components/UnassignSeiaButton.tsx" "app/(public)/admin/components/ProjectEditPageBody.tsx"
git commit -m "Add one-click unassign for a wrong SEIA match"
```

---

### Task 3: Persist and cache the on-demand AI suggestion

**Files:**
- Modify: `app/(public)/admin/verificador/aiSuggestionActions.ts` (persist the result via
  `saveAiScreeningResult`)
- Modify: `app/(public)/admin/verificador/AiSuggestionPanel.tsx` (accept a cached initial
  result)
- Modify: `app/(public)/admin/verificador/[id]/page.tsx` (build the initial result from
  `project` and pass it down)

**Interfaces:**
- Consumes: `saveAiScreeningResult` (Task 1); `ProjectDetail.aiScreenedAt/aiDataSanity/
  aiDataSanityReason/aiSeiaPick/aiSeiaPickReason` (Task 1)
- Produces: `AiSuggestionPanel` now requires an `initialResult: AiSuggestionResult | null` prop

- [ ] **Step 1: Persist the result inside `getAiVerificationSuggestion`**

In `app/(public)/admin/verificador/aiSuggestionActions.ts`, change the import line:

```ts
import { getProjectById, saveAiScreeningResult } from "@/lib/data-access/projects";
```

Change the body of `getAiVerificationSuggestion` (the `try` block) to save before
returning:

```ts
  try {
    const client = createSupabaseServiceClient();
    const project = await getProjectById(client, projectId);
    if (!project) {
      return { success: false, error: "Proyecto no encontrado." };
    }

    // Mismas palabras distintivas que usa findBestSeiaMatch — ver
    // lib/ingestion/sources/seia/match.ts. Así GLM ve el mismo universo de
    // candidatos que el matching determinístico, no una búsqueda distinta.
    const searchTerm = distinctiveTokens(project.name).join(" ");
    const seiaResponse = searchTerm ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES) : { data: [] as RawSeiaProject[] };
    const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

    const { suggestion, error } = await getGlmVerificationSuggestion(project, candidates);
    if (error || !suggestion) {
      return { success: false, error: error ?? "GLM no devolvió una sugerencia." };
    }

    await saveAiScreeningResult(client, projectId, suggestion);

    return { success: true, suggestion, candidates };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
```

- [ ] **Step 2: Accept a cached initial result in `AiSuggestionPanel`**

In `app/(public)/admin/verificador/AiSuggestionPanel.tsx`, change the function signature
and initial state:

```tsx
export function AiSuggestionPanel({
  projectId,
  initialResult,
}: {
  projectId: string;
  initialResult: AiSuggestionResult | null;
}) {
  const router = useRouter();
  const [result, setResult] = useState<AiSuggestionResult | null>(initialResult);
```

Change the button label line (the existing `result ? "Pedir de nuevo" : ...` ternary) to:

```tsx
          {loading ? "Pensando…" : result ? "Actualizar sugerencia" : "Pedir sugerencia de IA"}
```

No other change is needed in this file: the candidate lookup
(`result.candidates?.find(...)`) already handles an empty `candidates` array by falling
back to `Expediente ${result.suggestion.seiaPick}` text with the "Usar este candidato"
button disabled (`disabled={applying || !candidate}`) — exactly the right behavior for a
cached result, which has no live candidate list.

- [ ] **Step 3: Build the initial result in the detail page**

Replace the full contents of `app/(public)/admin/verificador/[id]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById, type ProjectDetail } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";
import { VerifyButton } from "../VerifyButton";
import { AiSuggestionPanel } from "../AiSuggestionPanel";
import { FormularioDocumentLink } from "../FormularioDocumentLink";
import type { AiSuggestionResult } from "../aiSuggestionActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  if (!(await isAdmin())) return { title: "Verificar proyecto" };
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Verificar — ${project.name}` : "Verificar proyecto" };
}

function buildInitialAiResult(project: ProjectDetail): AiSuggestionResult | null {
  if (!project.aiScreenedAt || !project.aiDataSanity) return null;
  return {
    success: true,
    suggestion: {
      dataSanity: project.aiDataSanity,
      dataSanityReason: project.aiDataSanityReason ?? "",
      seiaPick: project.aiSeiaPick,
      seiaPickReason: project.aiSeiaPickReason ?? "",
    },
    candidates: [],
  };
}

export default async function VerificarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return null;
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Verificando</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {project.name}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <VerifyButton projectId={project.id} />
          <FormularioDocumentLink projectId={project.id} />
        </div>
      </div>
      <AiSuggestionPanel projectId={project.id} initialResult={buildInitialAiResult(project)} />
      <ProjectEditPageBody client={client} project={project} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual check with the dev server**

Run: `npm run dev`, logged in as admin, open a never-screened project in
`/admin/verificador/[id]`:
1. Confirm the AI panel shows "Pedir sugerencia de IA" (no cached result).
2. Click it, wait for the result, confirm it renders normally (same as before this task).
3. Reload the page → confirm the panel now shows the cached result **immediately** (no
   "Pensando…" flash) and the button now says "Actualizar sugerencia".
4. Run the same DB check as Task 1 Step 8 (`ai_screened_at is not null` count) and
   confirm the count increased by 1.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/admin/verificador/aiSuggestionActions.ts" "app/(public)/admin/verificador/AiSuggestionPanel.tsx" "app/(public)/admin/verificador/[id]/page.tsx"
git commit -m "Persist AI suggestions and show cached results on load"
```

---

### Task 4: Batch screening script

**Files:**
- Create: `scripts/screen-verification-queue.ts`

**Interfaces:**
- Consumes: `getProjectById`, `saveAiScreeningResult` (Task 1); `searchSeiaByName`
  (`@/lib/ingestion/sources/seia/searchApi`); `distinctiveTokens`
  (`@/lib/ingestion/sources/seia/match`); `getGlmVerificationSuggestion`
  (`@/lib/ai/verification/glmSuggestion`); `RawSeiaProject`
  (`@/lib/ingestion/sources/seia/types`) — all pre-existing, unchanged

- [ ] **Step 1: Write the script**

```ts
// scripts/screen-verification-queue.ts
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { getProjectById, saveAiScreeningResult } from "../lib/data-access/projects";
import { searchSeiaByName } from "../lib/ingestion/sources/seia/searchApi";
import { distinctiveTokens } from "../lib/ingestion/sources/seia/match";
import { getGlmVerificationSuggestion } from "../lib/ai/verification/glmSuggestion";
import type { RawSeiaProject } from "../lib/ingestion/sources/seia/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env.local") });

const BATCH_SIZE = Number(process.argv[2] ?? "50");
const DELAY_MS = 400; // no golpear el servidor público de SEIA ni el rate limit de GLM sin pausas
const MAX_SEIA_CANDIDATES = 10;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: pending, error } = await client
    .from("project")
    .select("id")
    .is("verified_at", null)
    .is("ai_screened_at", null)
    .limit(BATCH_SIZE);
  if (error) throw new Error(error.message);

  console.log(`Proyectos pendientes de tamizar en esta corrida: ${(pending ?? []).length}.`);

  let screened = 0;
  let sospechosos = 0;
  let conPick = 0;
  let errors = 0;

  for (const row of pending ?? []) {
    const projectId = row.id as string;
    const start = Date.now();
    try {
      const project = await getProjectById(client, projectId);
      if (!project) {
        errors++;
        console.log(`  [error] ${projectId}: proyecto no encontrado`);
        continue;
      }

      const searchTerm = distinctiveTokens(project.name).join(" ");
      const seiaResponse = searchTerm
        ? await searchSeiaByName(searchTerm, MAX_SEIA_CANDIDATES)
        : { data: [] as RawSeiaProject[] };
      const candidates = seiaResponse.data.slice(0, MAX_SEIA_CANDIDATES);

      const { suggestion, error: glmError } = await getGlmVerificationSuggestion(project, candidates);
      if (glmError || !suggestion) {
        errors++;
        console.log(`  [error] ${project.name}: ${glmError ?? "GLM no devolvió una sugerencia"}`);
        continue;
      }

      await saveAiScreeningResult(client, projectId, suggestion);
      screened++;
      if (suggestion.dataSanity === "sospechoso") sospechosos++;
      if (suggestion.seiaPick) conPick++;
      console.log(
        `  [${suggestion.dataSanity}] ${project.name}${suggestion.seiaPick ? ` -> candidato ${suggestion.seiaPick}` : ""} (${Date.now() - start}ms)`,
      );
    } catch (err) {
      errors++;
      console.log(`  [error] ${projectId}: ${(err as Error).message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log("\n--- Resumen ---");
  console.log("Tamizados:", screened);
  console.log("Sospechosos:", sospechosos);
  console.log("Con candidato SEIA sugerido:", conPick);
  console.log("Errores:", errors);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Manual check against the real database**

Run: `npx tsx scripts/screen-verification-queue.ts 5`
Expected: logs "Proyectos pendientes de tamizar en esta corrida: 5.", then one line per
project (sanity + optional candidate + timing), then a summary with `Tamizados: 5` (or
fewer if some errored — check the error lines make sense). Re-run the same DB count
check from Task 1 Step 8 and confirm the count increased by the number screened.

- [ ] **Step 4: Commit**

```bash
git add scripts/screen-verification-queue.ts
git commit -m "Add manual batch script to screen the verification queue with GLM-5.2"
```

---

### Task 5: "Solo dudosos" filter, badge, and progress counter in `/admin/verificador`

**Files:**
- Modify: `app/(public)/admin/verificador/page.tsx`

**Interfaces:**
- Consumes: `getVerificationQueue`, `getDoubtfulProjects`, `getVerificationScreeningStats`,
  `VerificationQueueItem` (all Task 1)

- [ ] **Step 1: Replace the queue page**

Replace the full contents of `app/(public)/admin/verificador/page.tsx` with:

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import {
  getVerificationQueue,
  getDoubtfulProjects,
  getVerificationScreeningStats,
  type VerificationQueueItem,
} from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../../components/Panel";

export const metadata: Metadata = { title: "Verificador de proyecto" };
export const dynamic = "force-dynamic";

const QUEUE_PAGE_LIMIT = 100;

function isDoubtful(item: VerificationQueueItem): boolean {
  return item.aiDataSanity === "sospechoso" || item.aiSeiaPick !== null;
}

export default async function VerificadorPage({
  searchParams,
}: {
  searchParams: Promise<{ dudosos?: string }>;
}) {
  if (!(await isAdmin())) return null;
  const { dudosos } = await searchParams;
  const onlyDoubtful = dudosos === "1";
  const client = await createSupabaseServerClient();
  const [stats, queue] = await Promise.all([
    getVerificationScreeningStats(client),
    onlyDoubtful ? getDoubtfulProjects(client, QUEUE_PAGE_LIMIT) : getVerificationQueue(client, QUEUE_PAGE_LIMIT),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Verificador de proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {stats.totalPending.toLocaleString("es-CL")} proyectos pendientes de revisar en total — mostrando los
          primeros {queue.length.toLocaleString("es-CL")}
          {onlyDoubtful ? ", solo dudosos" : ", vigentes primero"}.
        </p>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {stats.screened.toLocaleString("es-CL")} de {stats.totalPending.toLocaleString("es-CL")} ya tamizados con IA
          — {stats.doubtful.toLocaleString("es-CL")} dudosos.
        </p>
        <div className="mt-3 flex gap-2 text-xs">
          <Link
            href="/admin/verificador"
            className={`rounded-full border px-3 py-1 font-medium ${
              !onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Todos
          </Link>
          <Link
            href="/admin/verificador?dudosos=1"
            className={`rounded-full border px-3 py-1 font-medium ${
              onlyDoubtful
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
            }`}
          >
            Solo dudosos
          </Link>
        </div>
      </div>

      {queue.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {onlyDoubtful
              ? "No hay proyectos dudosos tamizados todavía."
              : "No quedan proyectos pendientes de verificar."}
          </p>
        </Panel>
      ) : (
        <Panel className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">Proyecto</th>
                <th className="px-4 py-3 font-medium">Comuna / Región</th>
                <th className="px-4 py-3 text-right font-medium">MW</th>
                <th className="px-4 py-3 font-medium">Fecha conexión</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {queue.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">
                    {isDoubtful(p) && (
                      <span title="La IA marcó este proyecto para revisar" className="mr-1">
                        ⚠️
                      </span>
                    )}
                    {p.name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {[p.comuna, p.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                    {p.capacityMw !== null ? Math.round(p.capacityMw).toLocaleString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {p.estimatedConnectionDate ? new Date(p.estimatedConnectionDate).toLocaleDateString("es-CL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.status ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/verificador/${p.id}`}
                      className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                    >
                      Revisar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 3: Manual end-to-end check with the dev server**

Run: `npm run dev`, logged in as admin (after running Task 4's script at least once so
there's real screened data):
1. Visit `/admin/verificador` → confirm the new "X de Y ya tamizados con IA — Z dudosos"
   line appears under the existing pending-count line, and rows the AI flagged as doubtful
   show the ⚠️ badge even in this default ("Todos") view.
2. Click "Solo dudosos" → confirm the URL becomes `/admin/verificador?dudosos=1`, the tab
   highlights, and the list only contains rows with the ⚠️ badge.
3. Click "Todos" → confirm it returns to the full list.
4. Cross-check the "Z dudosos" count against the number of rows shown under "Solo
   dudosos" (should match, up to `QUEUE_PAGE_LIMIT`).

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/admin/verificador/page.tsx"
git commit -m "Add Solo dudosos filter, badge, and screening progress counter to Verificador"
```

## Self-Review Notes

- **Spec coverage:** Parte 1 (quitar match) → Task 2. Parte 2 (esquema, guardado
  compartido, caché on-demand, script batch, filtro/badge/contador) → Tasks 1, 3, 4, 5
  respectively. Every explicit user decision (unlink-only, no permanent flag, no cron,
  "dudoso" = sanity OR pick) is called out in Global Constraints and reflected in the
  matching task's code.
- **Placeholder scan:** no TBD/TODO; every step has runnable code or an exact command.
- **Type consistency:** `VerificationQueueItem.aiDataSanity` / `ProjectDetail.aiDataSanity`
  both typed `"ok" | "sospechoso" | null` (Task 1), consumed as-is by `isDoubtful` (Task 5)
  and `buildInitialAiResult` (Task 3) with no re-typing. `saveAiScreeningResult`'s
  `VerificationSuggestion` parameter (Task 1) is the same type already returned by
  `getGlmVerificationSuggestion` and consumed unchanged by both producers (Task 3's
  on-demand action, Task 4's batch script) — no shape drift between them.
