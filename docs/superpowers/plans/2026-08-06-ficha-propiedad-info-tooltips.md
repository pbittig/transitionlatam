# Ficha Propiedad + Info Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the public project ficha (`app/(public)/proyectos/[id]/page.tsx`), the Ownership section stays visible (as "en proceso") for verified projects even without ownership data, and every section title gets a hoverable/tappable (i) icon explaining what that section shows.

**Architecture:** One new shared client component (`InfoTooltip`) renders a small info icon + floating tooltip. It's wired into the existing `SectionLabel` helper (adds an optional `info` prop) and manually placed next to the two headings that don't use `SectionLabel` (Descripción, Propiedad). `ProjectOwnershipSection` is changed to accept a nullable `map` and render a new neutral `OwnershipInProcess` placeholder when there's no data yet, bypassing the Prime paywall in that case.

**Tech Stack:** Next.js App Router (server components + one new client component), React 19, Tailwind, lucide-react icons. No test framework in this repo — verification is `npm run typecheck`, `npm run lint`, and manual visual check via `npm run dev`.

## Global Constraints

- All visible text follows the existing bilingual inline pattern `locale === "en" ? "..." : "..."` already used throughout `page.tsx` — do not introduce a new i18n system.
- No new npm dependencies — `lucide-react` is already installed and has both `Info` and `Clock` icons (verified).
- Do not modify `lib/data-access/projectOwnership.ts`, the PGP sync logic, or any data-access query — this plan is presentation-only.
- Keep the existing `border-b border-neutral-100 pb-… dark:border-neutral-900` section wrapper conventions and existing Tailwind color tokens (`neutral-*`, `brand-primary`, `brand-deep`, `brand-surface`) — don't invent new colors.
- Every commit message in this plan must NOT include a `Co-Authored-By` trailer unless the user's global git workflow requires it elsewhere in the repo (check recent `git log` — this repo does use it for Claude-authored commits, so include it).

---

## Task 1: `InfoTooltip` shared component

**Files:**
- Create: `app/(public)/components/InfoTooltip.tsx`

**Interfaces:**
- Produces: `InfoTooltip({ text, locale }: { text: string; locale: AppLocale })` — default export is NOT used, it's a named export `InfoTooltip`. `AppLocale` comes from `@/lib/i18n` (already exported there, confirmed via existing usage in `app/(public)/proyectos/[id]/ProjectOwnershipSection.tsx:3`).

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function InfoTooltip({ text, locale }: { text: string; locale: AppLocale }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label={locale === "en" ? "More information" : "Más información"}
        className="flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-neutral-200 bg-white p-2.5 text-xs leading-5 text-neutral-600 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
        >
          {text}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors related to `InfoTooltip.tsx`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings related to `InfoTooltip.tsx`.

- [ ] **Step 4: Commit**

```bash
git add "app/(public)/components/InfoTooltip.tsx"
git commit -m "$(cat <<'EOF'
Add InfoTooltip component for section-title help text

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire info tooltips into non-ownership section titles

**Depends on:** Task 1 (`InfoTooltip`).

**Files:**
- Modify: `app/(public)/proyectos/[id]/page.tsx` (import, `SectionLabel`, description heading, 9 `SectionLabel` call sites)

**Interfaces:**
- Consumes: `InfoTooltip({ text, locale }: { text: string; locale: AppLocale })` from Task 1.
- Produces: `SectionLabel({ children, info, locale }: { children: React.ReactNode; info?: string; locale: AppLocale })` — `locale` becomes a required prop on every call site (it's already in scope as a local variable at every existing call site in this file).

- [ ] **Step 1: Add imports**

In `app/(public)/proyectos/[id]/page.tsx`, find this line (currently line 37):

```tsx
import { getAppLocale } from "@/lib/i18n";
```

Replace with:

```tsx
import { getAppLocale, type AppLocale } from "@/lib/i18n";
```

Then find this line (currently line 39, right after the `ShareProjectButton` import):

```tsx
import { ShareProjectButton } from "./ShareProjectButton";
```

Add immediately after it:

```tsx
import { InfoTooltip } from "../../components/InfoTooltip";
```

- [ ] **Step 2: Update `SectionLabel` to accept `info` and `locale`**

Find (currently lines 60-66):

```tsx
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
      {children}
    </h2>
  );
}
```

Replace with:

```tsx
function SectionLabel({ children, info, locale }: { children: React.ReactNode; info?: string; locale: AppLocale }) {
  const heading = (
    <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
      {children}
    </h2>
  );
  if (!info) return heading;
  return (
    <div className="flex items-center gap-1.5">
      {heading}
      <InfoTooltip text={info} locale={locale} />
    </div>
  );
}
```

- [ ] **Step 3: Add the info icon to the "Descripción" heading**

Find (currently lines 258-263):

```tsx
      <section className="border-b border-neutral-100 pb-8 dark:border-neutral-900" aria-labelledby="project-description-title">
        <h2 id="project-description-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
          {locale === "en" ? "Description" : "Descripción"}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">{projectDescription}</p>
      </section>
```

Replace with:

```tsx
      <section className="border-b border-neutral-100 pb-8 dark:border-neutral-900" aria-labelledby="project-description-title">
        <div className="flex items-center gap-1.5">
          <h2 id="project-description-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {locale === "en" ? "Description" : "Descripción"}
          </h2>
          <InfoTooltip
            text={locale === "en" ? "Automatically generated summary based on the project's technical and location data." : "Resumen generado automáticamente a partir de los datos técnicos y de ubicación del proyecto."}
            locale={locale}
          />
        </div>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">{projectDescription}</p>
      </section>
```

- [ ] **Step 4: Update the 9 `SectionLabel` call sites**

Each replacement below is a single-line-to-multi-line swap. Match by the exact existing line text (each is unique in the file).

Find:
```tsx
          <SectionLabel>{locale === "en" ? "Theoretical project status" : "Estado teórico del Proyecto"}</SectionLabel>
```
Replace:
```tsx
          <SectionLabel
            info={locale === "en" ? "Our own estimate of what stage the project should be at today, based on its declared connection date." : "Estimación propia de en qué etapa debería estar el proyecto hoy, según su fecha de conexión declarada."}
            locale={locale}
          >
            {locale === "en" ? "Theoretical project status" : "Estado teórico del Proyecto"}
          </SectionLabel>
```

Find:
```tsx
          <SectionLabel>Health Score</SectionLabel>
```
Replace:
```tsx
          <SectionLabel
            info={locale === "en" ? "Our own score (0–100) combining connection permitting progress and SEIA environmental progress; not an official figure." : "Puntaje propio (0–100) que combina el avance del trámite de conexión y el avance ambiental SEIA; no es un dato oficial."}
            locale={locale}
          >
            Health Score
          </SectionLabel>
```

Find:
```tsx
          <SectionLabel>{locale === "en" ? "Reported physical construction" : "Construcción física reportada"}</SectionLabel>
```
Replace:
```tsx
          <SectionLabel
            info={locale === "en" ? "Physical construction progress officially reported in the National Electricity Coordinator's Major Projects Program (PGP)." : "Porcentaje de avance físico de obra reportado oficialmente en el Programa de Grandes Proyectos (PGP) del Coordinador Eléctrico Nacional."}
            locale={locale}
          >
            {locale === "en" ? "Reported physical construction" : "Construcción física reportada"}
          </SectionLabel>
```

Find:
```tsx
        <SectionLabel>{locale === "en" ? "Permitting progress" : "Avance de tramitación"}</SectionLabel>
```
Replace:
```tsx
        <SectionLabel
          info={locale === "en" ? "Current status of the grid connection process and, if applicable, the environmental process (SEIA/Pertinencia)." : "Estado actual del trámite de conexión al sistema eléctrico y, si aplica, del trámite ambiental (SEIA/Pertinencia)."}
          locale={locale}
        >
          {locale === "en" ? "Permitting progress" : "Avance de tramitación"}
        </SectionLabel>
```

Find:
```tsx
          <SectionLabel>{locale === "en" ? "Estimated development stage" : "Etapa estimada de desarrollo"}</SectionLabel>
```
Replace:
```tsx
          <SectionLabel
            info={locale === "en" ? "Probabilistic model that works backward from the estimated connection date to place the project in a typical market development stage." : "Modelo probabilístico que calcula hacia atrás desde la fecha de conexión estimada para ubicar al proyecto en una etapa de desarrollo típica de mercado."}
            locale={locale}
          >
            {locale === "en" ? "Estimated development stage" : "Etapa estimada de desarrollo"}
          </SectionLabel>
```

Find:
```tsx
        <SectionLabel>{locale === "en" ? "Contact" : "Contacto"}</SectionLabel>
```
Replace:
```tsx
        <SectionLabel
          info={locale === "en" ? "Contact details for people linked to the project or the developer company." : "Datos de contacto de las personas vinculadas al proyecto o a la empresa desarrolladora."}
          locale={locale}
        >
          {locale === "en" ? "Contact" : "Contacto"}
        </SectionLabel>
```

Find:
```tsx
          <SectionLabel>{locale === "en" ? "Environmental status" : "Estado ambiental"}</SectionLabel>
```
Replace:
```tsx
          <SectionLabel
            info={locale === "en" ? "Status of the project's environmental filing with the SEIA, including pertinencia filings when applicable." : "Estado del expediente ambiental del proyecto en el SEIA, incluyendo pertinencias cuando corresponde."}
            locale={locale}
          >
            {locale === "en" ? "Environmental status" : "Estado ambiental"}
          </SectionLabel>
```

Find:
```tsx
            <SectionLabel>{locale === "en" ? "Related companies" : "Empresas relacionadas"}</SectionLabel>
```
Replace:
```tsx
            <SectionLabel
              info={locale === "en" ? "Other companies the National Electricity Coordinator groups with the developer under the same corporate group." : "Otras empresas que el Coordinador Eléctrico Nacional agrupa junto al desarrollador bajo el mismo grupo corporativo."}
              locale={locale}
            >
              {locale === "en" ? "Related companies" : "Empresas relacionadas"}
            </SectionLabel>
```

Find:
```tsx
        <SectionLabel>{locale === "en" ? "Related projects" : "Proyectos relacionados"}</SectionLabel>
```
Replace:
```tsx
        <SectionLabel
          info={locale === "en" ? "Other active projects linked by the same RUT, SPV, corporate group, or shared corporate contacts." : "Otros proyectos activos vinculados por mismo RUT, SPV, grupo empresarial o contactos corporativos compartidos."}
          locale={locale}
        >
          {locale === "en" ? "Related projects" : "Proyectos relacionados"}
        </SectionLabel>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. If you see `Property 'locale' is missing`, you missed one of the 9 call sites in Step 4 — search the file for `<SectionLabel>` (no props) to find it.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 7: Manual visual check**

Run: `npm run dev`, open any verified project ficha (e.g. `/proyectos/<id>` for a project with `verified_at` set — the admin verificador list at `/admin/verificador` links to fichas, or query the DB for a project with `verified_at is not null`). Confirm:
- Each of the 10 titles touched in this task shows a small (i) icon.
- Hovering (desktop) shows the tooltip text; clicking toggles it; clicking outside closes it.
- Dark mode (toggle OS/browser dark mode or the site's theme control if present) renders the tooltip with readable contrast.

- [ ] **Step 8: Commit**

```bash
git add "app/(public)/proyectos/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
Add info tooltips to ficha section titles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Ownership section — rename, always-visible for verified projects, null-safe placeholder

**Depends on:** Task 1 (`InfoTooltip`). Independent of Task 2 (touches a different part of the same file — apply after Task 2 lands to avoid a merge conflict on `page.tsx`, but does not functionally depend on it).

**Files:**
- Modify: `app/(public)/proyectos/[id]/ProjectOwnershipSection.tsx`
- Modify: `app/(public)/proyectos/[id]/page.tsx` (the ownership `<section>` block only)

**Interfaces:**
- Consumes: `InfoTooltip({ text, locale }: { text: string; locale: AppLocale })` from Task 1.
- Produces: `ProjectOwnershipSection({ map, projectName, locked, locale }: { map: ProjectOwnershipMap | null; projectName: string; locked: boolean; locale: AppLocale })` — `map` is now nullable (was required). Callers pass the existing `ownershipMap` variable unchanged; `page.tsx` already computes it as `ProjectOwnershipMap | null`.

- [ ] **Step 1: Add the `Clock` icon import**

In `app/(public)/proyectos/[id]/ProjectOwnershipSection.tsx`, find (currently line 1):

```tsx
import { Building2, LockKeyhole, UserRound } from "lucide-react";
```

Replace with:

```tsx
import { Building2, Clock, LockKeyhole, UserRound } from "lucide-react";
```

- [ ] **Step 2: Add the `OwnershipInProcess` component**

Find the existing `OwnershipPreview` function (currently lines 70-90, ending with its closing `}`):

```tsx
function OwnershipPreview({ locale }: { locale: AppLocale }) {
  return (
    <div className="relative min-h-80 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div aria-hidden className="flex select-none flex-col items-center opacity-45 blur-[3px]">
        <div className="h-20 w-44 rounded-xl border border-emerald-300 bg-emerald-50" />
        <Connector percent={100} />
        <div className="h-20 w-44 rounded-xl border border-sky-300 bg-sky-50" />
        <Connector percent={100} />
        <div className="h-20 w-44 rounded-xl border-2 border-brand-primary bg-brand-surface" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/35 backdrop-blur-[2px] dark:bg-neutral-950/35">
        <div className="max-w-sm rounded-2xl border border-white/80 bg-white/90 p-5 text-center shadow-xl dark:border-neutral-700 dark:bg-neutral-900/95">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-surface text-brand-primary"><LockKeyhole size={18} /></span>
          <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Ownership map available on Prime" : "Mapa de propiedad disponible en Prime"}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{locale === "en" ? "View owners, controllers, percentages and the complete corporate chain." : "Consulta propietarios, controladores, porcentajes y la cadena societaria completa."}</p>
          <Link href="/planes" className="mt-4 inline-flex rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-deep">{locale === "en" ? "View plans" : "Ver planes"}</Link>
        </div>
      </div>
    </div>
  );
}
```

Immediately after that closing `}`, insert a new function:

```tsx

function OwnershipInProcess({ locale }: { locale: AppLocale }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-8 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
      <Clock size={20} className="text-neutral-400" />
      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {locale === "en" ? "Ownership mapping in progress" : "Mapeo societario en proceso"}
      </p>
      <p className="max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
        {locale === "en"
          ? "We are still building this project's corporate ownership chain. Check back soon."
          : "Todavía estamos construyendo la cadena societaria de este proyecto. Vuelve pronto."}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Make `map` nullable and handle the no-data case first**

Find (currently line 92-93):

```tsx
export function ProjectOwnershipSection({ map, projectName, locked, locale }: { map: ProjectOwnershipMap; projectName: string; locked: boolean; locale: AppLocale }) {
  if (locked) return <OwnershipPreview locale={locale} />;
```

Replace with:

```tsx
export function ProjectOwnershipSection({ map, projectName, locked, locale }: { map: ProjectOwnershipMap | null; projectName: string; locked: boolean; locale: AppLocale }) {
  if (!map) return <OwnershipInProcess locale={locale} />;
  if (locked) return <OwnershipPreview locale={locale} />;
```

The rest of the function body (below this point) already only runs once `map` is known non-null, so no further changes are needed there — TypeScript narrows `map` to `ProjectOwnershipMap` after the `if (!map)` guard.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors in `ProjectOwnershipSection.tsx`.

- [ ] **Step 5: Update the ownership section block in `page.tsx`**

Find (currently lines 493-508):

```tsx
      {ownershipMap && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900" aria-labelledby="ownership-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ownership-title" className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {locale === "en" ? "Ownership and corporate group" : "Propiedad y grupo empresarial"}
            </h2>
            <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">Prime</span>
          </div>
          <p className="mt-2 mb-4 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            {locale === "en"
              ? "Direct owners, intermediate companies and ultimate controllers linked to the project SPV."
              : "Propietarios directos, sociedades intermedias y controladores finales vinculados a la SPV del proyecto."}
          </p>
          <ProjectOwnershipSection map={ownershipMap} projectName={project.name} locked={isFree} locale={locale} />
        </section>
      )}
```

Replace with:

```tsx
      {project.verifiedAt && (
        <section className="border-b border-neutral-100 pb-10 dark:border-neutral-900" aria-labelledby="ownership-title">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ownership-title" className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {locale === "en" ? "Ownership" : "Propiedad"}
            </h2>
            {ownershipMap && (
              <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">Prime</span>
            )}
            <InfoTooltip
              text={locale === "en" ? "Manually verified corporate chain: who owns the project's SPV and who the ultimate controller is." : "Cadena societaria verificada manualmente: quién es dueño de la SPV del proyecto y quién controla en última instancia."}
              locale={locale}
            />
          </div>
          <p className="mt-2 mb-4 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
            {locale === "en"
              ? "Direct owners, intermediate companies and ultimate controllers linked to the project SPV."
              : "Propietarios directos, sociedades intermedias y controladores finales vinculados a la SPV del proyecto."}
          </p>
          <ProjectOwnershipSection map={ownershipMap} projectName={project.name} locked={isFree} locale={locale} />
        </section>
      )}
```

Note: the `Prime` badge is now conditional on `ownershipMap` being non-null — per the spec, the "en proceso" state is neutral/non-promotional, so the Prime label (which implies a paywalled feature) only shows once there's actual data to gate.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 8: Manual visual check**

Run: `npm run dev` (or reuse the dev server from Task 2).

Find two verified projects via the DB or `/admin/verificador?periodo=historico` reverification views — one with `project_ownership_profile` populated and one without. (Query if needed: `select p.id, p.name from project p left join project_ownership_profile pop on pop.project_id = p.id where p.verified_at is not null and pop.project_id is null limit 5;` for a project with no ownership profile, using the same `.env.local`-driven connection pattern as existing scripts.)

Confirm:
- The project WITHOUT an ownership profile shows the "Propiedad" section with the "en proceso" message, no "Prime" badge, no lock icon.
- The project WITH an ownership profile behaves exactly as before (full tree if Prime/admin, blurred `OwnershipPreview` paywall if free-tier), and now shows "Propiedad" (not "Propiedad y grupo empresarial") plus the (i) icon.
- An unverified project still shows no Ownership section at all.

- [ ] **Step 9: Commit**

```bash
git add "app/(public)/proyectos/[id]/ProjectOwnershipSection.tsx" "app/(public)/proyectos/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
Show Ownership section as in-progress for verified projects without a mapped chain yet

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final check (after all tasks)

- [ ] Run `npm run typecheck && npm run lint` once more from a clean state to confirm no cross-task regressions.
- [ ] Re-read `docs/superpowers/specs/2026-08-06-ficha-propiedad-info-tooltips-design.md` section by section and confirm every item has a corresponding change:
  - §2.1 rename → Task 3, Step 5.
  - §2.2 always-visible for verified projects → Task 3, Step 5 (`project.verifiedAt` condition).
  - §2.3 neutral in-process state, no paywall → Task 3, Steps 2-3.
  - §3.1 `InfoTooltip` component → Task 1.
  - §3.2 integration (`SectionLabel` + 2 manual placements) → Task 2 (Descripción + 9 SectionLabel sites) + Task 3 (Propiedad).
  - §3.3 all 11 copy pairs → Task 2 (9) + Task 3 (1, "Propiedad") + Task 2 Step 3 (Descripción) = 11.
- [ ] Do not push to `origin/main` — leave commits local until the user explicitly asks to deploy (per this session's established workflow: pushes require explicit confirmation).
