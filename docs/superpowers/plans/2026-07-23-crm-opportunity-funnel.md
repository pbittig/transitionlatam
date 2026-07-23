# CRM Opportunity Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRM's 8-stage opportunity funnel with a 7-stage commercial one, let an admin add a project to the CRM with one click from its detail page or the Proyectos futuros table, add a search box to the CRM board, and add a "development stage" filter to Proyectos futuros.

**Architecture:** Extends the existing `/crm` Kanban board (table `opportunity`, `lib/data-access/opportunities.ts`) rather than building a new system. The stage enum moves to its own module so both `/crm` and the new project-detail button can import it without pulling in board-fetching code. The CRM board's search needs client-side state, so its rendering moves out of the (async, server-only) `page.tsx` into a new client component that receives already-fetched data as a prop — the page keeps doing data fetching, the component keeps doing interaction. The stage filter on Proyectos futuros reuses the probabilistic schedule model that already exists (`computeEstimatedPhase`) — no new column, no stored value, computed on every request exactly like the existing Gantt chart does.

**Tech Stack:** Next.js 16 (App Router, Server Actions, Server/Client Components), Supabase (Postgres + `@supabase/supabase-js`), TypeScript, Tailwind CSS.

## Global Constraints

- This repo has no automated test runner (no jest/vitest/pytest in `package.json`) — "run the test" steps below mean `npx tsc --noEmit` (must stay clean after every task) plus a manual check via the dev server or a one-off `tsx` script, matching how the rest of this codebase verifies changes.
- Every Supabase migration file goes in `supabase/migrations/`, named `YYYYMMDDNNNNNN_description.sql`, lowercase SQL (see any existing file for style).
- Every Server Action that mutates data must gate on `await isAdmin()` from `lib/auth/session.ts` and throw if false — this is the only auth check in the app, there is no row-level user permission system beyond admin/not-admin.
- Money/comment style: Spanish comments, matching the rest of the codebase — only comment the *why*, not the *what* (see existing files for the tone).
- `git commit` after every task, using the message style already in this repo's `git log` (short, present tense, explains why not what).

---

## Task 1: Move the opportunity stage enum to its own module, rename to 7 stages

**Files:**
- Create: `lib/shared/opportunityStages.ts`
- Modify: `lib/data-access/opportunities.ts:1-25` (remove the moved block, import instead)

**Interfaces:**
- Produces: `OPPORTUNITY_STAGES: readonly string[]`, `type OpportunityStage`, `OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string>`, `CLOSED_STAGES: readonly OpportunityStage[]` (the two terminal stages — used by later tasks to decide whether an opportunity still "counts" as active).

- [ ] **Step 1: Create the new stage module**

```ts
// lib/shared/opportunityStages.ts
// Etapas del funnel comercial (tabla opportunity) — separado de
// lib/data-access/opportunities.ts para que un componente que solo necesita
// los nombres de las etapas (ej. el botón "Agregar al CRM" en la ficha de un
// proyecto) no tenga que importar getOpportunityBoard() y su lógica de query.
export const OPPORTUNITY_STAGES = [
  "contacto",
  "reunion",
  "elaboracion_propuesta",
  "envio_propuesta",
  "seguimiento",
  "cierre_ganado",
  "cierre_perdido",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  contacto: "Contacto",
  reunion: "Reunión",
  elaboracion_propuesta: "Elaboración propuesta",
  envio_propuesta: "Envío propuesta",
  seguimiento: "Seguimiento",
  cierre_ganado: "Cierre — Ganado",
  cierre_perdido: "Cierre — Perdido",
};

/** Etapas terminales — una oportunidad acá no cuenta como "activa" para el botón de alta rápida. */
export const CLOSED_STAGES: readonly OpportunityStage[] = ["cierre_ganado", "cierre_perdido"];
```

- [ ] **Step 2: Point `opportunities.ts` at the new module**

Replace `lib/data-access/opportunities.ts:1-25` (everything from the top through the closing
`};` of `OPPORTUNITY_STAGE_LABEL`) with:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from "@/lib/shared/opportunityStages";

export { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage };
```

(Re-exporting keeps every existing `import { OPPORTUNITY_STAGES } from "@/lib/data-access/opportunities"` in `app/(public)/crm/*` working without touching those files in this task.)

- [ ] **Step 3: Fix the legacy-schema fallback's default stage**

In the same file, `getOpportunityBoard`'s legacy fallback branch (the `if (error?.code === "PGRST204" ...)` block) hardcodes `stage: "identificada"`. Change that literal to `stage: "contacto"` — `"identificada"` no longer exists as a valid `OpportunityStage`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (This will fail loudly if any file still references a dropped stage name like `"identificada"` as a typed `OpportunityStage` — that's the point of doing this rename first, before touching the UI.)

- [ ] **Step 5: Commit**

```bash
git add lib/shared/opportunityStages.ts lib/data-access/opportunities.ts
git commit -m "Rename CRM funnel to 7 stages (contacto..cierre_ganado/perdido)"
```

---

## Task 2: Migrate the database

**Files:**
- Create: `supabase/migrations/20260723000001_crm_funnel_7_stages.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SQL).
- Produces: `opportunity.stage` now constrained to the 7 values from Task 1, existing rows remapped, default changed to `'contacto'`.

- [ ] **Step 1: Write the migration**

```sql
-- Reemplaza el funnel comercial genérico de 8 etapas por uno de 7 con
-- nombres propios del proceso de venta de ONIX (ver docs/superpowers/specs/
-- 2026-07-23-crm-opportunity-funnel-design.md). Remapea las filas existentes
-- por cercanía semántica antes de aplicar el nuevo CHECK — "propuesta" cae en
-- "elaboracion_propuesta" (la más conservadora) porque el dato viejo no
-- distingue una propuesta en elaboración de una ya enviada.
update opportunity set stage = 'contacto'
  where stage in ('identificada', 'investigando', 'contacto_pendiente', 'contactada');
update opportunity set stage = 'reunion' where stage = 'conversacion';
update opportunity set stage = 'elaboracion_propuesta' where stage = 'propuesta';
update opportunity set stage = 'cierre_ganado' where stage = 'ganada';
update opportunity set stage = 'cierre_perdido' where stage = 'perdida';

alter table opportunity drop constraint opportunity_stage_check;
alter table opportunity alter column stage set default 'contacto';
alter table opportunity add constraint opportunity_stage_check
  check (stage in ('contacto', 'reunion', 'elaboracion_propuesta', 'envio_propuesta', 'seguimiento', 'cierre_ganado', 'cierre_perdido'));
```

- [ ] **Step 2: Apply it**

Run: `node scripts/run-migrations.mjs`
Expected: prints the new migration file name as applied, exits 0. (This script already exists and already runs every `.sql` file in `supabase/migrations/` that hasn't been applied — see the file for how it tracks that.)

- [ ] **Step 3: Verify no row was left with an old stage value**

```ts
// Run inline with: npx tsx -e "$(cat this snippet)"  — or save as a throwaway
// script under scripts/ and delete it after confirming, same as any other
// one-off verification in this repo.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data } = await client.from("opportunity").select("stage");
const valid = new Set(["contacto", "reunion", "elaboracion_propuesta", "envio_propuesta", "seguimiento", "cierre_ganado", "cierre_perdido"]);
console.log("filas con etapa inválida:", (data ?? []).filter((r) => !valid.has(r.stage)).length);
```

Expected output: `filas con etapa inválida: 0`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723000001_crm_funnel_7_stages.sql
git commit -m "Migrate opportunity.stage to the 7-stage commercial funnel"
```

---

## Task 3: Extract the CRM board into a client component with search, always show all 7 columns

**Files:**
- Create: `app/(public)/crm/OpportunityBoard.tsx`
- Modify: `app/(public)/crm/page.tsx` (replace the inline board JSX and `BOARD_STAGES` with a call to the new component)
- Modify: `lib/data-access/opportunities.ts` (drop the `.not("stage", "in", "(ganada,perdida)")` filter — the board now shows closed stages too)

**Interfaces:**
- Consumes: `OpportunityBoardItem` (already exported from `lib/data-access/opportunities.ts`), `OPPORTUNITY_STAGE_LABEL`/`OpportunityStage` (from Task 1), `updateOpportunityStage` (existing server action, unchanged signature).
- Produces: `OpportunityBoard({ opportunities: OpportunityBoardItem[] }): JSX.Element` — default export.

- [ ] **Step 1: Stop excluding closed stages from the query**

In `lib/data-access/opportunities.ts`, `getOpportunityBoard`, remove this line from the query chain:

```ts
.not("stage", "in", "(ganada,perdida)")
```

(The two closed stages are `cierre_ganado`/`cierre_perdido` now, and the board is about to render a column for each of the 7 stages including these two — so nothing should be excluded here anymore.)

- [ ] **Step 2: Write the new client component**

```tsx
// app/(public)/crm/OpportunityBoard.tsx
"use client";

import { useState } from "react";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABEL, type OpportunityStage } from "@/lib/shared/opportunityStages";
import type { OpportunityBoardItem } from "@/lib/data-access/opportunities";
import { Panel } from "../components/Panel";
import { updateOpportunityStage } from "./actions";

function matches(item: OpportunityBoardItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [item.project?.name, item.company?.name, item.person?.name].some((v) => v?.toLowerCase().includes(q));
}

export function OpportunityBoard({ opportunities }: { opportunities: OpportunityBoardItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = opportunities.filter((item) => matches(item, query));

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por proyecto, empresa o contacto..."
        className="w-full max-w-sm rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      />
      {opportunities.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          El tablero está listo para operar — aún no hay oportunidades creadas. Agrega una desde "Nueva oportunidad" arriba, o desde el botón "Agregar al CRM" en la ficha de cualquier proyecto.
        </p>
      )}
      {opportunities.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Ninguna oportunidad coincide con "{query}".</p>
      )}
      <div className="grid gap-4 xl:grid-cols-4">
        {OPPORTUNITY_STAGES.map((stage) => {
          const items = filtered.filter((item) => item.stage === stage);
          return (
            <Panel key={stage} className="flex min-h-44 flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{OPPORTUNITY_STAGE_LABEL[stage]}</h3>
                <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">{items.length}</span>
              </div>
              {items.map((item) => (
                <article key={item.id} id={`opportunity-${item.id}`} className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.project?.name ?? item.company?.name ?? "Oportunidad sin vínculo"}</p>
                  <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{item.company?.name ?? item.person?.name ?? item.type ?? "Contexto pendiente"}</p>
                  {item.description && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{item.description}</p>}
                  {item.nextStep && (
                    <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-300">
                      Próximo: {item.nextStep}
                      {item.nextStepAt ? ` · ${new Date(item.nextStepAt).toLocaleDateString("es-CL")}` : ""}
                    </p>
                  )}
                  <form action={updateOpportunityStage} className="mt-3">
                    <input type="hidden" name="id" value={item.id} />
                    <select name="stage" defaultValue={item.stage} className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1.5 text-xs dark:border-neutral-700">
                      <option value={item.stage}>Mover a…</option>
                      {OPPORTUNITY_STAGES.filter((option) => option !== item.stage).map((option: OpportunityStage) => (
                        <option key={option} value={option}>
                          {OPPORTUNITY_STAGE_LABEL[option]}
                        </option>
                      ))}
                    </select>
                    <button className="mt-1.5 text-xs font-medium text-brand-primary">Actualizar etapa</button>
                  </form>
                </article>
              ))}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `page.tsx`**

In `app/(public)/crm/page.tsx`:
1. Remove the `const BOARD_STAGES: OpportunityStage[] = [...]` line.
2. Change this import line:
   ```ts
   import { OPPORTUNITY_STAGE_LABEL, type OpportunityStage, getOpportunityBoard } from "@/lib/data-access/opportunities";
   ```
   to:
   ```ts
   import { getOpportunityBoard } from "@/lib/data-access/opportunities";
   import { OpportunityBoard } from "./OpportunityBoard";
   ```
   (`OPPORTUNITY_STAGE_LABEL` and `OpportunityStage` move into `OpportunityBoard.tsx`, which imports them itself from `@/lib/shared/opportunityStages` — `page.tsx` no longer renders stage labels directly, only fetches and passes data.)
3. Replace the entire `<section className="flex flex-col gap-3">...</section>` block (the one containing `{opportunities.length === 0 ? (...) : (...)}` and the `BOARD_STAGES.map` grid) with:

```tsx
<section className="flex flex-col gap-3">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Tablero comercial</p>
      <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Mover solo cuando la realidad comercial cambie</h2>
    </div>
    <Link href="/mapa-stakeholder" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">
      Ver relaciones <ArrowUpRight size={15} />
    </Link>
  </div>
  <OpportunityBoard opportunities={opportunities} />
</section>
```

4. The stat calculations near the top of the page (`contactReady`, `inConversation`) reference the old stage names — update them:

```ts
const contactReady = opportunities.filter((item) => item.stage === "contacto").length;
const inConversation = opportunities.filter((item) => item.stage === "reunion").length;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

Run the dev server, log in as admin, go to `/crm`. Expected: 7 columns always visible (Contacto, Reunión, Elaboración propuesta, Envío propuesta, Seguimiento, Cierre — Ganado, Cierre — Perdido), each showing "0" if there's no data yet — not the old "tablero vacío" placeholder message replacing them. Type something in the search box that matches nothing — expected: all columns show 0 and the "ninguna oportunidad coincide" message appears.

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/crm/OpportunityBoard.tsx app/\(public\)/crm/page.tsx lib/data-access/opportunities.ts
git commit -m "Always show all 7 funnel columns on the CRM board, add search"
```

---

## Task 4: Add `developerCompanyId` and `projectIds` filter to the project listing

**Files:**
- Modify: `lib/data-access/projects.ts:8-32` (`ProjectFilters`), `:45-64` (`ProjectListItem`), `:93-210` (`listProjects`)

**Interfaces:**
- Produces: `ProjectListItem.developerCompanyId: string | null`, `ProjectFilters.projectIds?: string[]`.

- [ ] **Step 1: Add the field to the two interfaces**

In `ProjectFilters` (around line 29, right after `namePatterns?: string[];`), add:

```ts
/** Restringe a estos IDs exactos — usado por filtros calculados en Node (ej. etapa estimada) que no se pueden expresar como columna de la tabla project. */
projectIds?: string[];
```

In `ProjectListItem` (around line 62, right after `developerCompany: string | null;`), add:

```ts
developerCompanyId: string | null;
```

- [ ] **Step 2: Select the raw column and apply the filter in `listProjects`**

In the `.select(...)` call inside `listProjects` (the long template string starting with `` `id, name, capacity_mw...` ``), add `developer_company_id` right after `id, name,`:

```ts
`id, name, developer_company_id, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, technology:technology_id(name, code), ${locationEmbed}, ${countryEmbed}, developer:developer_company_id(name), spv:spv_id(name)`,
```

Right after the existing `if (filters.search && filters.search.trim()) query = query.ilike("name", ...)` line, add:

```ts
if (filters.projectIds) query = query.in("id", filters.projectIds);
```

In the row-mapping type (`const r = row as unknown as { ... }`), add `developer_company_id: string | null;` to the type, and in the returned object (right after `developerCompany: r.developer?.name ?? null,`), add:

```ts
developerCompanyId: r.developer_company_id,
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean — this will fail if any other file constructs a `ProjectListItem` object literal without the new required field. If it does fail there, that call site needs `developerCompanyId: null` (or the real value if available) added — fix inline, it means another place in the codebase builds a `ProjectListItem` by hand instead of through `listProjects()`.

- [ ] **Step 4: Commit**

```bash
git add lib/data-access/projects.ts
git commit -m "Add developerCompanyId and projectIds filter to listProjects"
```

---

## Task 5: Helper to check which projects already have an active opportunity

**Files:**
- Create: `lib/data-access/crmOpportunities.ts`

**Interfaces:**
- Consumes: `CLOSED_STAGES` (Task 1).
- Produces: `getActiveOpportunityProjectIds(client: SupabaseClient, projectIds: string[]): Promise<Set<string>>`, `createProjectOpportunity(client: SupabaseClient, args: { projectId: string; projectName: string; developerCompanyId: string | null }): Promise<void>`.

- [ ] **Step 1: Write the module**

```ts
// lib/data-access/crmOpportunities.ts
// Puente entre un `project` y el CRM comercial (tabla opportunity) — separado
// de lib/data-access/opportunities.ts porque ese archivo es sobre el tablero
// (leer/agrupar oportunidades existentes); este es sobre engancharlas a un
// proyecto puntual desde la ficha o la tabla de Proyectos futuros.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLOSED_STAGES } from "@/lib/shared/opportunityStages";

/**
 * Para un lote de proyectos (ej. los 20 de una página de tabla), cuáles ya
 * tienen una oportunidad en una etapa no cerrada — evita un N+1 (una consulta
 * por fila) y evita mostrar "Agregar al CRM" para un proyecto que ya está.
 */
export async function getActiveOpportunityProjectIds(client: SupabaseClient, projectIds: string[]): Promise<Set<string>> {
  if (projectIds.length === 0) return new Set();
  const { data, error } = await client
    .from("opportunity")
    .select("project_id")
    .in("project_id", projectIds)
    .not("stage", "in", `(${CLOSED_STAGES.join(",")})`);
  if (error) throw new Error(`Error revisando oportunidades activas: ${error.message}`);
  return new Set((data ?? []).map((r) => r.project_id as string).filter((id): id is string => id !== null));
}

/** Alta rápida de un click — ver AddToCrmButton.tsx. Etapa inicial fija: "contacto". */
export async function createProjectOpportunity(
  client: SupabaseClient,
  args: { projectId: string; projectName: string; developerCompanyId: string | null },
): Promise<void> {
  const { error } = await client.from("opportunity").insert({
    project_id: args.projectId,
    company_id: args.developerCompanyId,
    stage: "contacto",
    description: `Proyecto: ${args.projectName}`,
    confidence_level: "INTELIGENCIA_DE_MERCADO",
  });
  if (error) throw new Error(`Error agregando proyecto al CRM: ${error.message}`);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/data-access/crmOpportunities.ts
git commit -m "Add helpers to link a project to a CRM opportunity"
```

---

## Task 6: Server action + button component for "Agregar al CRM"

**Files:**
- Create: `app/(public)/crmActions.ts`
- Create: `app/(public)/components/AddToCrmButton.tsx`

**Interfaces:**
- Consumes: `createProjectOpportunity` (Task 5), `isAdmin` (existing, `lib/auth/session.ts`), `createSupabaseServiceClient` (existing).
- Produces: `addProjectToOpportunity(projectId: string, projectName: string, developerCompanyId: string | null): Promise<{ success: boolean; error?: string }>`; `AddToCrmButton({ projectId, projectName, developerCompanyId, initiallyInCrm, compact? }): JSX.Element`.

- [ ] **Step 1: Write the server action**

Follow the exact pattern of `app/(public)/watchlistActions.ts` (same file layout, same error handling):

```ts
// app/(public)/crmActions.ts
"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { createProjectOpportunity } from "@/lib/data-access/crmOpportunities";

/** Agrega un proyecto al CRM como oportunidad nueva en etapa "Contacto" — requiere sesión de admin. */
export async function addProjectToOpportunity(
  projectId: string,
  projectName: string,
  developerCompanyId: string | null,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    await createProjectOpportunity(createSupabaseServiceClient(), { projectId, projectName, developerCompanyId });
    revalidatePath(`/proyectos/${projectId}`);
    revalidatePath("/proyectos-esperados");
    revalidatePath("/crm");
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Write the button**

Mirrors `app/(public)/proyectos/[id]/FollowButton.tsx` exactly (same `useState`/`useTransition` shape), with a `compact` mode for use inside a table cell (icon only, no border/padding meant for a toolbar) versus the ficha (icon in a bordered square, matching `FollowButton`'s look):

```tsx
// app/(public)/components/AddToCrmButton.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BriefcaseBusiness, CircleCheck } from "lucide-react";
import { addProjectToOpportunity } from "../crmActions";

export function AddToCrmButton({
  projectId,
  projectName,
  developerCompanyId,
  initiallyInCrm,
  compact = false,
}: {
  projectId: string;
  projectName: string;
  developerCompanyId: string | null;
  initiallyInCrm: boolean;
  compact?: boolean;
}) {
  const [inCrm, setInCrm] = useState(initiallyInCrm);
  const [pending, startTransition] = useTransition();

  if (inCrm) {
    return (
      <Link
        href="/crm"
        title="Ya está en el CRM — ver en el tablero"
        aria-label="Ver en el CRM"
        className={
          compact
            ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-brand-primary hover:bg-neutral-100 dark:hover:bg-neutral-800"
            : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-900 bg-neutral-900 text-white dark:border-neutral-50 dark:bg-neutral-50 dark:text-neutral-900"
        }
      >
        <CircleCheck size={compact ? 15 : 16} strokeWidth={2} />
      </Link>
    );
  }

  function handleAdd() {
    startTransition(async () => {
      const result = await addProjectToOpportunity(projectId, projectName, developerCompanyId);
      if (result.success) setInCrm(true);
    });
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={pending}
      title="Agregar al CRM"
      aria-label="Agregar al CRM"
      className={
        compact
          ? "inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
          : "print:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }
    >
      <BriefcaseBusiness size={compact ? 15 : 16} strokeWidth={2} />
    </button>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/crmActions.ts app/\(public\)/components/AddToCrmButton.tsx
git commit -m "Add one-click 'add to CRM' action and button component"
```

---

## Task 7: Wire the button into the project detail page

**Files:**
- Modify: `app/(public)/proyectos/[id]/page.tsx`

**Interfaces:**
- Consumes: `AddToCrmButton` (Task 6), `getActiveOpportunityProjectIds` (Task 5), `createSupabaseServiceClient` (existing).

- [ ] **Step 1: Import the new pieces**

Add near the other imports (after `import { FollowButton } from "./FollowButton";`):

```ts
import { AddToCrmButton } from "../../components/AddToCrmButton";
import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";
```

- [ ] **Step 2: Compute whether this project is already in the CRM**

Right after the existing line `const followed = admin ? await isProjectFollowed(createSupabaseServiceClient(), id) : false;`, add:

```ts
const alreadyInCrm = admin ? (await getActiveOpportunityProjectIds(createSupabaseServiceClient(), [id])).has(id) : false;
```

- [ ] **Step 3: Render the button next to `FollowButton`**

Change:

```tsx
{admin && <FollowButton projectId={project.id} initiallyFollowed={followed} />}
```

to:

```tsx
{admin && (
  <>
    <FollowButton projectId={project.id} initiallyFollowed={followed} />
    <AddToCrmButton
      projectId={project.id}
      projectName={project.name}
      developerCompanyId={project.developerCompanyId}
      initiallyInCrm={alreadyInCrm}
    />
  </>
)}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean.

Manual: open a project's ficha as admin, click "Agregar al CRM" (briefcase icon). Expected: the icon changes to a checkmark link; going to `/crm` shows the project as a card in the "Contacto" column. Reload the ficha — expected: the button still shows the checkmark state (not the plain briefcase again), because `alreadyInCrm` is now computed from the database on every load.

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/proyectos/\[id\]/page.tsx
git commit -m "Add 'Agregar al CRM' button to the project detail page"
```

---

## Task 8: Wire the button into the Proyectos futuros table

**Files:**
- Modify: `app/(public)/components/ProjectTable.tsx`
- Modify: `app/(public)/proyectos-esperados/page.tsx`

**Interfaces:**
- Consumes: `AddToCrmButton` (Task 6), `getActiveOpportunityProjectIds` (Task 5).
- `ProjectTable` gains two new props: `admin: boolean`, `crmProjectIds: Set<string>` (both required — pass `admin={false}` / `crmProjectIds={new Set()}` at any other call site, but today `ProjectTable` only has the one call site in `proyectos-esperados/page.tsx`, so this is the only place that needs updating).

- [ ] **Step 1: Add the column to `ProjectTable`**

In `app/(public)/components/ProjectTable.tsx`:

1. Add to the import list: `import { AddToCrmButton } from "./AddToCrmButton";`
2. Change the function signature to:

```ts
export function ProjectTable({
  items,
  seiaByProjectId,
  admin,
  crmProjectIds,
}: {
  items: ProjectListItem[];
  seiaByProjectId?: Map<string, SeiaRecordForProject>;
  admin: boolean;
  crmProjectIds: Set<string>;
}) {
```

3. Add a header cell — right after the closing `</th>` of "Health Score" (the last one in `<thead>`), add (only when `admin`, matching how the SEIA column is conditional):

```tsx
{admin && <th className="px-4 py-3 font-medium">CRM</th>}
```

4. Add the matching body cell — right after the `<td>` that renders `<HealthScoreBadge .../>`, before the closing `</tr>`, add:

```tsx
{admin && (
  <td className="px-4 py-3">
    <AddToCrmButton
      projectId={p.id}
      projectName={p.name}
      developerCompanyId={p.developerCompanyId}
      initiallyInCrm={crmProjectIds.has(p.id)}
      compact
    />
  </td>
)}
```

- [ ] **Step 2: Compute `crmProjectIds` on the page and pass both new props**

In `app/(public)/proyectos-esperados/page.tsx`:

1. Add to imports: `import { getActiveOpportunityProjectIds } from "@/lib/data-access/crmOpportunities";` and `import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";`
2. Right after the existing `const seiaByProjectId = await getSeiaRecordsForProjects(client, result.items.map((p) => p.id));` line, add:

```ts
const crmProjectIds = admin
  ? await getActiveOpportunityProjectIds(createSupabaseServiceClient(), result.items.map((p) => p.id))
  : new Set<string>();
```

3. Update the `<ProjectTable .../>` call to:

```tsx
<ProjectTable items={result.items} seiaByProjectId={seiaByProjectId} admin={admin} crmProjectIds={crmProjectIds} />
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean.

Manual: as admin, go to `/proyectos-esperados`. Expected: a "CRM" column appears with a briefcase icon per row; clicking it on a project not yet in the CRM adds it (icon becomes a checkmark) without a page reload; the same project's ficha page now also shows the checkmark state. As a non-admin (log out), the CRM column should not appear at all.

- [ ] **Step 4: Commit**

```bash
git add app/\(public\)/components/ProjectTable.tsx app/\(public\)/proyectos-esperados/page.tsx
git commit -m "Add 'Agregar al CRM' action to the Proyectos futuros table"
```

---

## Task 9: Add the grouped "etapa estimada" mapping

**Files:**
- Modify: `lib/shared/projectPhaseDurations.ts`

**Interfaces:**
- Produces: `PHASE_GROUPS: readonly string[]` (5 keys), `PHASE_GROUP_LABELS: Record<string, string>`, `PHASE_TO_GROUP: Record<PhaseKey, string>`.

- [ ] **Step 1: Add the mapping**

Add near `PHASE_LABELS` (after it, since it references `PhaseKey`):

```ts
// Agrupación de las 10 etapas del modelo en 5 "grandes etapas" para el filtro
// de Proyectos futuros — alguien buscando "algo temprano" o "un proyecto en
// compras" no conoce (ni necesita conocer) la jerga interna de 10 etapas.
export const PHASE_GROUPS = ["temprano", "ingenieria", "compras", "construccion", "comisionamiento"] as const;
export type PhaseGroup = (typeof PHASE_GROUPS)[number];

export const PHASE_GROUP_LABELS: Record<PhaseGroup, string> = {
  temprano: "Desarrollo temprano",
  ingenieria: "Ingeniería",
  compras: "Compras",
  construccion: "Construcción",
  comisionamiento: "Comisionamiento / Pruebas",
};

export const PHASE_TO_GROUP: Record<PhaseKey, PhaseGroup> = {
  campana_viento: "temprano",
  desarrollo: "temprano",
  conceptual: "temprano",
  basica: "ingenieria",
  detalle: "ingenieria",
  factibilidad: "ingenieria",
  compras: "compras",
  construccion: "construccion",
  comisionamiento: "comisionamiento",
  pruebas: "comisionamiento",
};
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: clean. (TypeScript will error here if `PHASE_TO_GROUP` is missing any `PhaseKey` — that's `Record<PhaseKey, PhaseGroup>` doing its job; every one of the 10 keys must be present.)

- [ ] **Step 3: Commit**

```bash
git add lib/shared/projectPhaseDurations.ts
git commit -m "Add 5-group mapping of the 10 development phases"
```

---

## Task 10: Add the "etapa estimada" filter to Proyectos futuros

**Files:**
- Modify: `app/(public)/proyectos-esperados/page.tsx`

**Interfaces:**
- Consumes: `computeEstimatedPhase` (existing), `PHASE_TO_GROUP`/`PHASE_GROUPS`/`PHASE_GROUP_LABELS`/`type PhaseGroup` (Task 9).

- [ ] **Step 1: Accept the new query param**

Change the `searchParams` type to add `etapa?: string`:

```ts
searchParams: Promise<{ tech?: string; page?: string; tab?: string; q?: string; etapa?: string }>;
```

And read it alongside the other params:

```ts
const etapaGroup = params.etapa as PhaseGroup | undefined;
```

Add the import: `import { PHASE_GROUPS, PHASE_GROUP_LABELS, PHASE_TO_GROUP, type PhaseGroup } from "@/lib/shared/projectPhaseDurations";` (alongside the existing `computeEstimatedPhase` import, which is *not* currently imported on this page — add that import too: `import { computeEstimatedPhase } from "@/lib/shared/computeEstimatedPhase";`).

- [ ] **Step 2: Fetch schedule inputs before the parallel batch, compute the matching project IDs**

The page currently fetches `scheduleInputs` *inside* the big `Promise.all([...])` alongside `listProjects`. That no longer works once the etapa filter needs to feed into `listProjects` — pull it out and await it first:

Change:

```ts
const [
  result,
  mapData,
  funnel,
  calendar,
  scheduleInputs,
  scopeTotals,
  ...
] = await Promise.all([
  listProjects(client, filters, page, PAGE_SIZE),
  getProjectsForMap(client, { technologyCodes, namePatterns, search }),
  getPipelineFunnel(client),
  getConnectionCalendar(client),
  getUpcomingScheduleInputs(client),
  getPipelineScopeTotals(client),
  ...
]);
```

to:

```ts
const scheduleInputs = await getUpcomingScheduleInputs(client);

const etapaProjectIds = etapaGroup
  ? scheduleInputs
      .filter((i) => {
        const phase = computeEstimatedPhase(i.estimatedConnectionDate, i.technologyCode, i.includesStorage, i.capacityMw);
        return phase?.currentPhase != null && PHASE_TO_GROUP[phase.currentPhase] === etapaGroup;
      })
      .map((i) => i.id)
  : undefined;

const [
  result,
  mapData,
  funnel,
  calendar,
  scopeTotals,
  ...
] = await Promise.all([
  listProjects(client, { ...filters, projectIds: etapaProjectIds }, page, PAGE_SIZE),
  getProjectsForMap(client, { technologyCodes, namePatterns, search }),
  getPipelineFunnel(client),
  getConnectionCalendar(client),
  getPipelineScopeTotals(client),
  ...
]);
```

(Remove `scheduleInputs` from the destructured array and from the `Promise.all` array — it's now fetched separately above. Keep every other entry in the same relative order, just with `getUpcomingScheduleInputs(client)` deleted from the list.)

- [ ] **Step 3: Add the UI control**

The page (`proyectos-esperados/page.tsx`) is an `async` Server Component, so the `<select>`'s
`onChange` needs to live in its own Client Component — every other filter on this page already
navigates by building an href (see `TechChipFilter`, `SearchBar`), so match that convention
instead of a plain inline handler.

Create `app/(public)/components/EtapaFilter.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PHASE_GROUPS, PHASE_GROUP_LABELS } from "@/lib/shared/projectPhaseDurations";

export function EtapaFilter({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("etapa") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("etapa", value);
    else params.delete("etapa");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="etapa" className="text-sm text-neutral-600 dark:text-neutral-400">
        Etapa estimada:
      </label>
      <select
        id="etapa"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
      >
        <option value="">Todas las etapas</option>
        {PHASE_GROUPS.map((g) => (
          <option key={g} value={g}>
            {PHASE_GROUP_LABELS[g]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

In `proyectos-esperados/page.tsx`, import it (`import { EtapaFilter } from "../components/EtapaFilter";`) and render `<EtapaFilter basePath="/proyectos-esperados" />` right after the `<TechChipFilter .../>` call in the filter panel.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean.

Manual: go to `/proyectos-esperados`, pick "Compras" from the new "Etapa estimada" dropdown. Expected: the URL gains `?etapa=compras`, the table's result count drops (not to zero, unless there truly are no projects in that stage right now), and every row that remains — check a few fichas — shows "Etapa estimada de desarrollo: Compras" in its own detail page. Switch to "Desarrollo temprano" — expected: a different, typically larger set of projects.

- [ ] **Step 5: Commit**

```bash
git add app/\(public\)/components/EtapaFilter.tsx app/\(public\)/proyectos-esperados/page.tsx
git commit -m "Add estimated development stage filter to Proyectos futuros"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Section A (funnel migration) → Tasks 1-2. Bug fix ("tablero vacío no muestra las columnas") → Task 3. Section B (add-to-CRM button, both ficha and table per the user's follow-up) → Tasks 4-8. Section C (search) → Task 3. Section D (etapa filter) → Tasks 9-10. Every section of the spec has a task.
- **Scope not covered here (matches spec's "Fuera de alcance"):** the etapa filter does not touch `getProjectsForMap` (the map view) or the analysis charts below the table — only the paginated table, because those go through a SQL RPC (`get_map_region_bubbles`) that doesn't accept a project ID list, and extending it wasn't asked for.
- **Type consistency check:** `OpportunityStage` (Task 1) is used identically in `opportunities.ts`, `OpportunityBoard.tsx`, and `crmOpportunities.ts` — same import path (`@/lib/shared/opportunityStages`) everywhere, no duplicate re-declaration. `ProjectListItem.developerCompanyId` (Task 4) is consumed with the exact same name by `AddToCrmButton` callers in Tasks 7-8.
