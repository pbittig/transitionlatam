# Admin: Verificador de proyecto + Editar data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `/admin` section with two tools that share one editable-ficha component: a "Verificador de proyecto" review queue (auto-save, one-time "Verificado" gate) and an "Editar data" page to correct any project's ficha at any time.

**Architecture:** New Next.js route group `app/(public)/admin/` gated by the existing `isAdmin()` session check (same pattern as `/alertas`). One new nullable column (`project.verified_at`) drives the queue. A single client component (`ProjectEditForm`) renders the editable fields and auto-saves each one through a new whitelisted server action (`updateProjectField`), reusing the existing service-role-client write pattern from `seiaActions.ts`/`watchlistActions.ts`. The existing `SeiaMatchModal` and `SeiaStatusCard` are embedded as-is, not rebuilt.

**Tech Stack:** Next.js 16 (App Router, React Server Components), TypeScript (strict), Supabase (Postgres + PostgREST via `@supabase/supabase-js`), Tailwind CSS, lucide-react icons.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-admin-verificador-editar-data-design.md` — every requirement below traces back to it.
- Single admin model: `isAdmin()` (`lib/auth/session.ts`) is a single-account session check, not a multi-user role. Never add a "verified by" / "edited by" field — there is nobody else to attribute it to.
- Writes only ever go through `createSupabaseServiceClient()` (`lib/data-access/supabase-service-client.ts`), gated by `if (!(await isAdmin())) return { success: false, error: "..." }` at the top of every server action — never trust a client-supplied admin flag.
- `updateProjectField` must only ever write a column from its explicit whitelist — never interpolate an arbitrary client-supplied column name.
- **No test runner exists in this repo** (no `test` script in `package.json`, no Jest/Vitest, no `tests/` directory). Every task's verification step is `npx tsc --noEmit` + `npm run lint`, plus a concrete manual check (dev server or a one-off `node`/`npx tsx` check) — matching how the two prior specs in `docs/superpowers/specs/` were verified. Do not introduce a test framework as part of this plan.
- Follow existing formatting conventions exactly: double quotes, Tailwind utility classes matching neutral-50..950 + dark: variants already used throughout `app/(public)/components/`, Spanish UI copy.
- One deviation from the approved spec, found while mapping the ficha's real fields: the spec's editable-field list omitted plain `capacidad (MW)` (`project.capacity_mw`) — the ficha's `dl` only shows generation/storage MW when `includesStorage` is true, so most (non-storage) projects would have had *no* MW field editable at all. `capacityMw` is added to the whitelist below to close that gap; it is the same headline MW field referenced in `docs/superpowers/specs/2026-07-25-admin-verificador-editar-data-design.md`'s own context section (the MW/MWh backfill work). No other field is added beyond the spec.

---

### Task 1: Database column + read functions

**Files:**
- Create: `supabase/migrations/20260725000000_project_verification.sql`
- Create: `lib/data-access/connectionStatuses.ts`
- Modify: `lib/data-access/projects.ts` (add `verifiedAt` to `ProjectDetail`/`getProjectById`, add `VerificationQueueItem`, `getVerificationQueue`, `countUnverifiedProjects`)

**Interfaces:**
- Produces: `ProjectDetail.verifiedAt: string | null` (ISO timestamp or null)
- Produces: `getVerificationQueue(client: SupabaseClient, limit?: number): Promise<VerificationQueueItem[]>` where `VerificationQueueItem = { id: string; name: string; comuna: string | null; region: string | null; capacityMw: number | null; estimatedConnectionDate: string | null; status: string | null }`
- Produces: `countUnverifiedProjects(client: SupabaseClient): Promise<number>`
- Produces: `getConnectionStatuses(client: SupabaseClient): Promise<ConnectionStatusOption[]>` where `ConnectionStatusOption = { code: string; label: string }`, from `lib/data-access/connectionStatuses.ts`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260725000000_project_verification.sql
-- Verificador de proyecto: marca cuándo un admin revisó y confirmó la ficha.
-- null = pendiente de verificar. Todos los proyectos existentes nacen null,
-- lo que los deja automáticamente en el backlog inicial de la cola.
alter table project add column if not exists verified_at timestamptz;
```

- [ ] **Step 2: Apply the migration against the real database**

Run: `node scripts/run-migrations.mjs`
Expected: output lists `20260725000000_project_verification.sql` as applied (or already-applied if run twice), no errors. Uses `.env.local` + `supabase/certs/supabase-root-2021-ca.pem`, same as every prior migration in this repo.

- [ ] **Step 3: Add the new reference-table read function**

```ts
// lib/data-access/connectionStatuses.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ConnectionStatusOption {
  code: string;
  label: string;
}

/** Vocabulario de estados de solicitud (17 valores sembrados en connection_status) — usado para el <select> de estado en los formularios de edición admin. */
export async function getConnectionStatuses(client: SupabaseClient): Promise<ConnectionStatusOption[]> {
  const { data, error } = await client
    .from("connection_status")
    .select("code, label")
    .order("label", { ascending: true });
  if (error) throw new Error(`Error obteniendo estados de conexión: ${error.message}`);
  return (data ?? []).map((row) => ({ code: row.code as string, label: row.label as string }));
}
```

- [ ] **Step 4: Add `verifiedAt` to `ProjectDetail` and `getProjectById`**

In `lib/data-access/projects.ts`, modify the `ProjectDetail` interface (around line 249) to add one field:

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
}
```

In `getProjectById`, add `verified_at` to the `.select(...)` string (after `estimated_connection_date`):

```ts
  const { data, error } = await client
    .from("project")
    .select(
      "id, name, internal_code, external_reference, nup, capacity_mw, capacity_mwh, net_injection_mw, net_withdrawal_mw, generation_capacity_mw, storage_capacity_mw, storage_hours, includes_storage, status, estimated_connection_date, verified_at, developer_company_id, technology:technology_id(name, code), location:location_id(comuna, region:region_id(name)), country:country_id(code), developer:developer_company_id(name, rut, legal_address), spv:spv_id(name), project_connection(connection_point, voltage_level, request_type)",
    )
    .eq("id", id)
    .maybeSingle();
```

Add `verified_at: string | null;` to the inline row type `r` (after `estimated_connection_date: string | null;`), and add `verifiedAt: r.verified_at,` to the returned object (after `estimatedConnectionDate: r.estimated_connection_date,`).

- [ ] **Step 5: Add the verification queue and count functions**

Append to `lib/data-access/projects.ts` (after `getProjectById`, before `ProjectTimelineEntry`):

```ts
export interface VerificationQueueItem {
  id: string;
  name: string;
  comuna: string | null;
  region: string | null;
  capacityMw: number | null;
  estimatedConnectionDate: string | null;
  status: string | null;
}

/**
 * Cola del Verificador: proyectos con verified_at null. Mismo criterio
 * "esperados primero" que scripts/sync-formulario-bulk.ts — vigentes (no
 * rechazados/desistidos, fecha de conexión desde el inicio de mes) antes que
 * el resto (rechazados, desistidos, vencidos, o sin fecha).
 */
export async function getVerificationQueue(client: SupabaseClient, limit = 500): Promise<VerificationQueueItem[]> {
  const startOfMonth = startOfCurrentMonthIso();
  const selectClause =
    "id, name, capacity_mw, estimated_connection_date, status, location:location_id(comuna, region:region_id(name))";

  const [{ data: esperados, error: e1 }, { data: resto, error: e2 }] = await Promise.all([
    client
      .from("project")
      .select(selectClause)
      .is("verified_at", null)
      .not("status", "in", `(${REJECTED_STATUSES.join(",")})`)
      .gte("estimated_connection_date", startOfMonth)
      .order("estimated_connection_date", { ascending: true })
      .limit(limit),
    client
      .from("project")
      .select(selectClause)
      .is("verified_at", null)
      .or(
        `status.in.(${REJECTED_STATUSES.join(",")}),estimated_connection_date.lt.${startOfMonth},estimated_connection_date.is.null`,
      )
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);
  if (e1) throw new Error(`Error obteniendo cola de verificación: ${e1.message}`);
  if (e2) throw new Error(`Error obteniendo cola de verificación: ${e2.message}`);

  type Row = {
    id: string;
    name: string;
    capacity_mw: number | null;
    estimated_connection_date: string | null;
    status: string | null;
    location: { comuna: string | null; region: { name: string } | null } | null;
  };

  const seen = new Set<string>();
  const merged = [...((esperados ?? []) as unknown as Row[]), ...((resto ?? []) as unknown as Row[])].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return merged.slice(0, limit).map((row) => ({
    id: row.id,
    name: row.name,
    comuna: row.location?.comuna ?? null,
    region: row.location?.region?.name ?? null,
    capacityMw: row.capacity_mw,
    estimatedConnectionDate: row.estimated_connection_date,
    status: row.status,
  }));
}

/** Conteo total de proyectos sin verificar — para la tarjeta de /admin. */
export async function countUnverifiedProjects(client: SupabaseClient): Promise<number> {
  const { count, error } = await client.from("project").select("id", { count: "exact", head: true }).is("verified_at", null);
  if (error) throw new Error(`Error contando proyectos sin verificar: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean, no errors.

- [ ] **Step 7: Manual check against the real database**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {createClient}=require('@supabase/supabase-js'); const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); c.from('project').select('id',{count:'exact',head:true}).is('verified_at', null).then(r => console.log('unverified:', r.count))"`
Expected: prints a count close to the total project count (all existing projects start unverified — should be in the thousands, matching the ~2700+ figure from the spec).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260725000000_project_verification.sql lib/data-access/connectionStatuses.ts lib/data-access/projects.ts
git commit -m "Add project.verified_at column and verification-queue read functions"
```

---

### Task 2: Server actions (write path)

**Files:**
- Create: `app/(public)/admin/projectEditActions.ts`

**Interfaces:**
- Consumes: `isAdmin(): Promise<boolean>` from `@/lib/auth/session`; `createSupabaseServiceClient()` from `@/lib/data-access/supabase-service-client`; `getVerificationQueue` from `@/lib/data-access/projects` (Task 1)
- Produces: `type EditableProjectField` (union of 15 field names, listed below)
- Produces: `updateProjectField(projectId: string, field: EditableProjectField, value: string | number | null): Promise<{ success: boolean; error?: string }>`
- Produces: `markProjectVerified(projectId: string): Promise<{ success: boolean; nextProjectId?: string | null; error?: string }>`

- [ ] **Step 1: Write the actions file**

```ts
// app/(public)/admin/projectEditActions.ts
"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getVerificationQueue } from "@/lib/data-access/projects";

export type EditableProjectField =
  | "name"
  | "capacityMw"
  | "capacityMwh"
  | "generationCapacityMw"
  | "storageCapacityMw"
  | "storageHours"
  | "status"
  | "estimatedConnectionDate"
  | "nup"
  | "developerCompanyRut"
  | "developerCompanyAddress"
  | "spvName"
  | "connectionPoint"
  | "voltageLevel"
  | "requestType";

const PROJECT_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  name: "name",
  capacityMw: "capacity_mw",
  capacityMwh: "capacity_mwh",
  generationCapacityMw: "generation_capacity_mw",
  storageCapacityMw: "storage_capacity_mw",
  storageHours: "storage_hours",
  status: "status",
  estimatedConnectionDate: "estimated_connection_date",
  nup: "nup",
};

const COMPANY_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  developerCompanyRut: "rut",
  developerCompanyAddress: "legal_address",
};

const SPV_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  spvName: "name",
};

const CONNECTION_COLUMNS: Partial<Record<EditableProjectField, string>> = {
  connectionPoint: "connection_point",
  voltageLevel: "voltage_level",
  requestType: "request_type",
};

/**
 * Auto-save por campo desde ProjectEditForm — escribe en la tabla que
 * corresponda según el campo (project / company / spv / project_connection).
 * `field` está tipado a EditableProjectField, así que el whitelist de arriba
 * es exhaustivo: nunca se interpola un nombre de columna que no esté en una
 * de las cuatro listas.
 */
export async function updateProjectField(
  projectId: string,
  field: EditableProjectField,
  value: string | number | null,
): Promise<{ success: boolean; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }

  try {
    const client = createSupabaseServiceClient();

    if (PROJECT_COLUMNS[field]) {
      const { error } = await client.from("project").update({ [PROJECT_COLUMNS[field]!]: value }).eq("id", projectId);
      if (error) throw new Error(error.message);
    } else if (COMPANY_COLUMNS[field]) {
      const { data: projectRow, error: projectError } = await client
        .from("project")
        .select("developer_company_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);
      if (!projectRow?.developer_company_id) {
        return { success: false, error: "Este proyecto no tiene empresa desarrolladora asociada todavía." };
      }
      const { error } = await client
        .from("company")
        .update({ [COMPANY_COLUMNS[field]!]: value })
        .eq("id", projectRow.developer_company_id as string);
      if (error) throw new Error(error.message);
    } else if (SPV_COLUMNS[field]) {
      const { data: projectRow, error: projectError } = await client
        .from("project")
        .select("spv_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);
      if (!projectRow?.spv_id) {
        return { success: false, error: "Este proyecto no tiene SPV asociada todavía." };
      }
      const { error } = await client
        .from("spv")
        .update({ [SPV_COLUMNS[field]!]: value })
        .eq("id", projectRow.spv_id as string);
      if (error) throw new Error(error.message);
    } else if (CONNECTION_COLUMNS[field]) {
      const { error } = await client
        .from("project_connection")
        .update({ [CONNECTION_COLUMNS[field]!]: value })
        .eq("project_id", projectId);
      if (error) throw new Error(error.message);
    } else {
      return { success: false, error: "Campo no editable." };
    }

    revalidatePath(`/admin/verificador/${projectId}`);
    revalidatePath(`/admin/editar-data/${projectId}`);
    revalidatePath(`/proyectos/${projectId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Marca un proyecto como verificado (sale de la cola para siempre) y
 * devuelve el id del siguiente proyecto pendiente para que el botón de la UI
 * pueda redirigir directo a él — ver spec: "redirige automáticamente al
 * siguiente proyecto pendiente".
 */
export async function markProjectVerified(
  projectId: string,
): Promise<{ success: boolean; nextProjectId?: string | null; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: "Debes iniciar sesión como administrador." };
  }
  try {
    const client = createSupabaseServiceClient();
    const { error } = await client.from("project").update({ verified_at: new Date().toISOString() }).eq("id", projectId);
    if (error) throw new Error(error.message);

    const queue = await getVerificationQueue(client, 1);
    revalidatePath("/admin/verificador");
    revalidatePath(`/admin/editar-data/${projectId}`);
    return { success: true, nextProjectId: queue[0]?.id ?? null };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If TypeScript complains about indexing `client.from(...).update({ [COLUMNS[field]!]: value })`, confirm `createSupabaseServiceClient` (Task-independent, already in the repo) is not using a generated `Database` type — it isn't (see `lib/data-access/supabase-service-client.ts`, `createClient(url, key, opts)` with no type param), so dynamic keys typecheck as plain `Record<string, unknown>` updates, same as every other action file in this repo.

- [ ] **Step 3: Manual check**

Run: `node -e "require('dotenv').config({path:'.env.local'}); const {createClient}=require('@supabase/supabase-js'); const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); c.from('project').select('id').limit(1).then(async r => { const id=r.data[0].id; const u = await c.from('project').update({nup:'TEST-PLAN-CHECK'}).eq('id', id); console.log('update error:', u.error); const back = await c.from('project').update({nup: null}).eq('id', id); console.log('revert error:', back.error); })"`
Expected: both `update error` and `revert error` print `null` — confirms the `project` table accepts writes from the service client exactly as `updateProjectField`'s `PROJECT_COLUMNS` branch will do (this checks the underlying write path directly since the action itself requires an authenticated admin session, which a one-off `node -e` script doesn't have).

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/admin/projectEditActions.ts"
git commit -m "Add admin server actions: updateProjectField, markProjectVerified"
```

---

### Task 3: Shared edit form + ficha body

**Files:**
- Create: `app/(public)/admin/components/ProjectEditForm.tsx`
- Create: `app/(public)/admin/components/ProjectEditPageBody.tsx`

**Interfaces:**
- Consumes: `EditableProjectField`, `updateProjectField` from `../projectEditActions` (Task 2); `ProjectDetail` from `@/lib/data-access/projects` (Task 1); `getConnectionStatuses`, `ConnectionStatusOption` from `@/lib/data-access/connectionStatuses` (Task 1); `getSeiaRecordForProject` from `@/lib/data-access/seia` (existing); `SeiaMatchModal` from `../../proyectos/[id]/SeiaMatchModal` (existing); `SeiaStatusCard` from `../../components/SeiaStatusCard` (existing)
- Produces: `ProjectEditForm({ project, connectionStatusOptions }: { project: ProjectDetail; connectionStatusOptions: string[] })` — client component
- Produces: `ProjectEditPageBody({ client, project }: { client: SupabaseClient; project: ProjectDetail })` — async server component, used by Tasks 5 and 6

- [ ] **Step 1: Write the edit form**

```tsx
// app/(public)/admin/components/ProjectEditForm.tsx
"use client";

import { useState } from "react";
import { updateProjectField, type EditableProjectField } from "../projectEditActions";
import type { ProjectDetail } from "@/lib/data-access/projects";

type FieldStatus = "idle" | "saving" | "saved" | "error";

const TEXT_FIELDS: Array<{ key: EditableProjectField; label: string }> = [
  { key: "name", label: "Nombre" },
  { key: "developerCompanyRut", label: "RUT" },
  { key: "developerCompanyAddress", label: "Dirección legal" },
  { key: "spvName", label: "SPV" },
  { key: "connectionPoint", label: "Punto de conexión" },
  { key: "voltageLevel", label: "Nivel de tensión (kV)" },
  { key: "nup", label: "NUP" },
];

const NUMBER_FIELDS: Array<{ key: EditableProjectField; label: string }> = [
  { key: "capacityMw", label: "Capacidad (MW)" },
  { key: "capacityMwh", label: "Energía (MWh)" },
  { key: "generationCapacityMw", label: "Potencia de generación (MW)" },
  { key: "storageCapacityMw", label: "Potencia de almacenamiento (MW)" },
  { key: "storageHours", label: "Horas de almacenamiento" },
];

const REQUEST_TYPE_OPTIONS = ["SAC", "SUCTD", "FEHACIENTE"];

function toNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toNullableText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function fieldValues(project: ProjectDetail): Record<EditableProjectField, string> {
  return {
    name: project.name,
    capacityMw: project.capacityMw !== null ? String(project.capacityMw) : "",
    capacityMwh: project.capacityMwh !== null ? String(project.capacityMwh) : "",
    generationCapacityMw: project.generationCapacityMw !== null ? String(project.generationCapacityMw) : "",
    storageCapacityMw: project.storageCapacityMw !== null ? String(project.storageCapacityMw) : "",
    storageHours: project.storageHours !== null ? String(project.storageHours) : "",
    status: project.status ?? "",
    estimatedConnectionDate: project.estimatedConnectionDate ?? "",
    nup: project.nup ?? "",
    developerCompanyRut: project.developerCompanyRut ?? "",
    developerCompanyAddress: project.developerCompanyAddress ?? "",
    spvName: project.spv ?? "",
    connectionPoint: project.connectionPoint ?? "",
    voltageLevel: project.voltageLevel ?? "",
    requestType: project.requestType ?? "",
  };
}

export function ProjectEditForm({
  project,
  connectionStatusOptions,
}: {
  project: ProjectDetail;
  connectionStatusOptions: string[];
}) {
  const [values, setValues] = useState(fieldValues(project));
  const [status, setStatus] = useState<Partial<Record<EditableProjectField, FieldStatus>>>({});

  async function save(field: EditableProjectField, value: string | number | null) {
    setStatus((prev) => ({ ...prev, [field]: "saving" }));
    const result = await updateProjectField(project.id, field, value);
    setStatus((prev) => ({ ...prev, [field]: result.success ? "saved" : "error" }));
  }

  function StatusHint({ field }: { field: EditableProjectField }) {
    const s = status[field];
    if (s === "saving") return <span className="text-xs text-neutral-400">Guardando…</span>;
    if (s === "saved") return <span className="text-xs text-emerald-600 dark:text-emerald-400">Guardado ✓</span>;
    if (s === "error") return <span className="text-xs text-red-600 dark:text-red-400">Error — reintenta</span>;
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 md:grid-cols-4">
      {TEXT_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
          <input
            type="text"
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={(e) => save(key, toNullableText(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <StatusHint field={key} />
        </label>
      ))}

      {NUMBER_FIELDS.map(({ key, label }) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
          <input
            type="number"
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={(e) => save(key, toNullableNumber(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
          />
          <StatusHint field={key} />
        </label>
      ))}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Tipo de solicitud</span>
        <select
          value={values.requestType}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, requestType: e.target.value }));
            save("requestType", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">— Sin definir —</option>
          {REQUEST_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <StatusHint field="requestType" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Estado</span>
        <select
          value={values.status}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, status: e.target.value }));
            save("status", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        >
          <option value="">— Sin definir —</option>
          {connectionStatusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <StatusHint field="status" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">Fecha estimada de conexión</span>
        <input
          type="date"
          value={values.estimatedConnectionDate}
          onChange={(e) => {
            setValues((prev) => ({ ...prev, estimatedConnectionDate: e.target.value }));
            save("estimatedConnectionDate", toNullableText(e.target.value));
          }}
          className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
        />
        <StatusHint field="estimatedConnectionDate" />
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Write the shared ficha body (form + SEIA block)**

```tsx
// app/(public)/admin/components/ProjectEditPageBody.tsx
import type { SupabaseClient } from "@supabase/supabase-js";
import { getConnectionStatuses } from "@/lib/data-access/connectionStatuses";
import { getSeiaRecordForProject } from "@/lib/data-access/seia";
import type { ProjectDetail } from "@/lib/data-access/projects";
import { ProjectEditForm } from "./ProjectEditForm";
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
          <SeiaMatchModal projectId={project.id} hasExistingMatch={!!seiaRecord} isAdmin />
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

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. (Full behavioral verification of this form happens in Task 5, its first real consumer — an isolated component with no page mounting it yet can only be checked for compiling correctly.)

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/admin/components/ProjectEditForm.tsx" "app/(public)/admin/components/ProjectEditPageBody.tsx"
git commit -m "Add shared ProjectEditForm and ProjectEditPageBody components"
```

---

### Task 4: Admin shell — layout, landing page, nav item

**Files:**
- Create: `app/(public)/admin/layout.tsx`
- Create: `app/(public)/admin/page.tsx`
- Modify: `app/(public)/components/Sidebar.tsx`

**Interfaces:**
- Consumes: `isAdmin()` from `@/lib/auth/session`; `countUnverifiedProjects` from `@/lib/data-access/projects` (Task 1); `createSupabaseServerClient` from `@/lib/data-access/supabase-server-client`; `Panel` from `../components/Panel`
- Produces: gated `/admin` route — everything under it is only reachable by an authenticated admin

- [ ] **Step 1: Write the gating layout**

```tsx
// app/(public)/admin/layout.tsx
import Link from "next/link";
import { isAdmin } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Esta sección es solo para administradores — inicia sesión para continuar.
        </p>
        <Link
          href="/login"
          className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-900"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Write the landing page**

```tsx
// app/(public)/admin/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, PencilLine } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { countUnverifiedProjects } from "@/lib/data-access/projects";
import { Panel } from "../components/Panel";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const client = await createSupabaseServerClient();
  const pendingCount = await countUnverifiedProjects(client);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Herramientas internas de mantenimiento de datos.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/verificador">
          <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <ShieldCheck size={18} /> Verificador de proyecto
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {pendingCount.toLocaleString("es-CL")} proyectos pendientes de revisar.
            </p>
          </Panel>
        </Link>
        <Link href="/admin/editar-data">
          <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
              <PencilLine size={18} /> Editar data
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Busca y corrige cualquier ficha de proyecto.</p>
          </Panel>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the nav item to the Sidebar**

In `app/(public)/components/Sidebar.tsx`, change the lucide-react import (line 5) from:

```tsx
import { Activity, Bell, ChartNoAxesCombined, ContactRound, Network, LogIn, LogOut } from "lucide-react";
```

to:

```tsx
import { Activity, Bell, ChartNoAxesCombined, ContactRound, Network, LogIn, LogOut, ShieldCheck } from "lucide-react";
```

Change the `navItems` line (line 27) from:

```tsx
  const navItems = isAdmin ? [...NAV_ITEMS, { href: "/alertas", label: "Seguimiento", icon: Bell }] : NAV_ITEMS;
```

to:

```tsx
  const navItems = isAdmin
    ? [
        ...NAV_ITEMS,
        { href: "/alertas", label: "Seguimiento", icon: Bell },
        { href: "/admin", label: "Admin", icon: ShieldCheck },
      ]
    : NAV_ITEMS;
```

This keeps "Admin" as the last nav item — it lands directly above the profile block, which already has its own `border-t` separator below `<nav>`.

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual check with the dev server**

Run: `npm run dev`, then in a browser:
1. Visit `/admin` while logged out (or in an incognito window) → expect the "solo para administradores" message and an "Ingresar" button, not the landing page.
2. Log in as admin (`/login`), visit `/admin` → expect the landing page with two cards, "Verificador de proyecto" showing a real pending count (in the thousands) and "Editar data".
3. Confirm the sidebar shows "Admin" as the last nav item, directly above the profile block (clicking the cards will 404 for now — `/admin/verificador` and `/admin/editar-data` are built in Tasks 5 and 6).

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/admin/layout.tsx" "app/(public)/admin/page.tsx" "app/(public)/components/Sidebar.tsx"
git commit -m "Add /admin shell: gated layout, landing page, sidebar nav item"
```

---

### Task 5: Verificador de proyecto (the queue)

**Files:**
- Create: `app/(public)/admin/verificador/page.tsx`
- Create: `app/(public)/admin/verificador/[id]/page.tsx`
- Create: `app/(public)/admin/verificador/VerifyButton.tsx`

**Interfaces:**
- Consumes: `getVerificationQueue`, `countUnverifiedProjects`, `getProjectById` from `@/lib/data-access/projects` (Task 1); `ProjectEditPageBody` from `../components/ProjectEditPageBody` / `../../components/ProjectEditPageBody` (Task 3); `markProjectVerified` from `../projectEditActions` (Task 2)

- [ ] **Step 1: Write the queue list page**

```tsx
// app/(public)/admin/verificador/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getVerificationQueue, countUnverifiedProjects } from "@/lib/data-access/projects";
import { Panel } from "../../components/Panel";

export const metadata: Metadata = { title: "Verificador de proyecto" };
export const dynamic = "force-dynamic";

const QUEUE_PAGE_LIMIT = 100;

export default async function VerificadorPage() {
  const client = await createSupabaseServerClient();
  const [totalPending, queue] = await Promise.all([
    countUnverifiedProjects(client),
    getVerificationQueue(client, QUEUE_PAGE_LIMIT),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          Verificador de proyecto
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {totalPending.toLocaleString("es-CL")} proyectos pendientes de revisar en total — mostrando los primeros{" "}
          {queue.length.toLocaleString("es-CL")}, vigentes primero.
        </p>
      </div>

      {queue.length === 0 ? (
        <Panel>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">No quedan proyectos pendientes de verificar.</p>
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
                  <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">{p.name}</td>
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

- [ ] **Step 2: Write the "Verificado" button**

```tsx
// app/(public)/admin/verificador/VerifyButton.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { markProjectVerified } from "../projectEditActions";

export function VerifyButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markProjectVerified(projectId);
      if (result.success) {
        router.push(result.nextProjectId ? `/admin/verificador/${result.nextProjectId}` : "/admin/verificador");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <CheckCircle2 size={16} /> {pending ? "Guardando…" : "Verificado"}
    </button>
  );
}
```

- [ ] **Step 3: Write the detail/review page**

```tsx
// app/(public)/admin/verificador/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById } from "@/lib/data-access/projects";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";
import { VerifyButton } from "../VerifyButton";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Verificar — ${project.name}` : "Verificar proyecto" };
}

export default async function VerificarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
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
        <VerifyButton projectId={project.id} />
      </div>
      <ProjectEditPageBody client={client} project={project} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual end-to-end check with the dev server**

Run: `npm run dev`, logged in as admin:
1. Visit `/admin/verificador` → expect a table of pending projects, "vigentes primero" (nearest connection date at top before rejected/expired ones).
2. Click "Revisar" on the first row → expect the detail page with all fields populated from the real ficha, plus the SEIA block and a "Verificado" button.
3. Edit the "Nombre" field, tab/click away (blur) → expect "Guardando…" then "Guardado ✓" next to that field. Reload the page → confirm the edited value persisted.
4. Edit "Capacidad (MW)" with a number → confirm it saves and the header MW figure is consistent after reload.
5. Click "Verificado" → expect an automatic redirect either to the next pending project's detail page, or to `/admin/verificador` if none remain.
6. Go back to `/admin/verificador` → confirm the project just verified no longer appears in the list, and the "proyectos pendientes de revisar en total" count decreased by 1.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/admin/verificador/"
git commit -m "Add /admin/verificador review queue with auto-save and Verificado button"
```

---

### Task 6: Editar data (free-form editor)

**Files:**
- Create: `app/(public)/admin/components/AdminProjectListTable.tsx`
- Create: `app/(public)/admin/editar-data/page.tsx`
- Create: `app/(public)/admin/editar-data/[id]/page.tsx`

**Interfaces:**
- Consumes: `listProjects`, `ProjectListItem`, `getProjectById` from `@/lib/data-access/projects` (existing + Task 1); `SearchBar` from `../../components/SearchBar` (existing); `Pager` from `../../components/Pager` (existing); `ProjectEditPageBody` from `../components/ProjectEditPageBody` (Task 3)

- [ ] **Step 1: Write the lightweight admin list table**

```tsx
// app/(public)/admin/components/AdminProjectListTable.tsx
import Link from "next/link";
import type { ProjectListItem } from "@/lib/data-access/projects";

export function AdminProjectListTable({ items }: { items: ProjectListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin proyectos para esta búsqueda.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="border-b border-neutral-200 text-left text-xs font-medium tracking-wide text-neutral-500 uppercase dark:border-neutral-800 dark:text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Proyecto</th>
            <th className="px-4 py-3 font-medium">Empresa</th>
            <th className="px-4 py-3 font-medium">Región</th>
            <th className="px-4 py-3 text-right font-medium">MW</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr
              key={p.id}
              className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900"
            >
              <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-50">{p.name}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.developerCompany ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{p.region ?? "—"}</td>
              <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400">
                {p.capacityMw !== null ? Math.round(p.capacityMw).toLocaleString("es-CL") : "—"}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/editar-data/${p.id}`}
                  className="text-sm font-medium text-neutral-700 underline underline-offset-2 hover:text-brand-primary dark:text-neutral-300"
                >
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write the searchable list page**

```tsx
// app/(public)/admin/editar-data/page.tsx
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { listProjects } from "@/lib/data-access/projects";
import { SearchBar } from "../../components/SearchBar";
import { Pager } from "../../components/Pager";
import { Panel } from "../../components/Panel";
import { AdminProjectListTable } from "../components/AdminProjectListTable";

export const metadata: Metadata = { title: "Editar data" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function EditarDataPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1") || 1;
  const client = await createSupabaseServerClient();
  const result = await listProjects(client, { search: params.q }, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(overrides: Record<string, string | undefined>): string {
    const merged = { q: params.q, page: params.page, ...overrides };
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) qs.set(key, value);
    }
    const query = qs.toString();
    return query ? `/admin/editar-data?${query}` : "/admin/editar-data";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Editar data</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {result.totalCount.toLocaleString("es-CL")} proyectos — busca cualquiera para corregir sus datos.
        </p>
      </div>
      <SearchBar
        basePath="/admin/editar-data"
        value={params.q}
        otherParams={{}}
        placeholder="Buscar por nombre de proyecto..."
      />
      <Panel className="flex flex-col gap-4">
        <AdminProjectListTable items={result.items} />
        <Pager page={page} totalPages={totalPages} buildHref={(p) => buildHref({ page: String(p) })} />
      </Panel>
    </div>
  );
}
```

- [ ] **Step 3: Write the detail/edit page**

```tsx
// app/(public)/admin/editar-data/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getProjectById } from "@/lib/data-access/projects";
import { ProjectEditPageBody } from "../../components/ProjectEditPageBody";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  return { title: project ? `Editar — ${project.name}` : "Editar proyecto" };
}

export default async function EditarProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await createSupabaseServerClient();
  const project = await getProjectById(client, id);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Editando</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          {project.name}
        </h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          {project.verifiedAt
            ? `Verificado el ${new Date(project.verifiedAt).toLocaleDateString("es-CL")}`
            : "Pendiente de verificación"}
        </p>
      </div>
      <ProjectEditPageBody client={client} project={project} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean.

- [ ] **Step 5: Manual end-to-end check with the dev server**

Run: `npm run dev`, logged in as admin:
1. Visit `/admin/editar-data` → expect a searchable, paginated list of all projects (not just pending ones).
2. Search for the project you verified in Task 5's manual check → confirm it's found (proves it's not excluded once verified).
3. Click "Editar" → expect the detail page showing "Verificado el [fecha de hoy]" (not "Pendiente de verificación").
4. Edit a different field (e.g. "Punto de conexión"), confirm auto-save works exactly like in the Verificador page.
5. Open a project that was never touched in Task 5 → confirm it shows "Pendiente de verificación" and has no "Verificado" button (only the editor + verification status label).
6. From this page, edit a field on that still-unverified project, then go to `/admin/verificador` and confirm it's still present in the queue (editing from Editar data must not verify it).

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/admin/components/AdminProjectListTable.tsx" "app/(public)/admin/editar-data/"
git commit -m "Add /admin/editar-data: searchable project list and free-form editor"
```

---

## Self-Review Notes

- **Spec coverage:** every section of `docs/superpowers/specs/2026-07-25-admin-verificador-editar-data-design.md` maps to a task — data model (Task 1), nav placement (Task 4), shared edit form + autosave (Task 3), server actions/whitelist (Task 2), Verificador queue + one-time gate + auto-redirect (Task 5), Editar data + verified badge (Task 6). "Editar web" and Kimi are explicitly out of scope per the spec and are not present in this plan.
- **Placeholder scan:** no TBD/TODO; every step has runnable code or an exact command.
- **Type consistency:** `EditableProjectField` (Task 2) is the same union used by `ProjectEditForm` (Task 3); `ProjectDetail.verifiedAt` (Task 1) is the field read by `admin/editar-data/[id]/page.tsx` (Task 6); `VerificationQueueItem`/`getVerificationQueue` (Task 1) is what `markProjectVerified` (Task 2) and both `admin/verificador/page.tsx` and its detail page (Task 5) consume — checked consistent throughout.
