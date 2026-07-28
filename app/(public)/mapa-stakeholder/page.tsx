import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, ContactRound, Fingerprint, FolderKanban, GitBranch, Network, Search, ShieldCheck, UserRoundCog } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCompanyById, getCompanyShareholders, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { Panel } from "../components/Panel";
import { StakeholderMap } from "../components/StakeholderMap";
import { PlanGate } from "../components/PlanGate";
import { isAdmin } from "@/lib/auth/session";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";

export const metadata: Metadata = { title: "Empresas y relaciones" };
export const dynamic = "force-dynamic";

export default async function MapaStakeholderPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const params = await searchParams;
  const client = await createSupabaseServerClient();
  const admin = await isAdmin();
  const profile = admin ? null : await getCurrentUserProfile(client);
  const premiumLocked = !admin && profile?.planCode !== "premium";
  const companies = await getTopCompaniesByProjectCount(client, 40);
  const selectedId = params.empresa ?? companies[0]?.id;
  const company = selectedId ? await getCompanyById(client, selectedId) : null;
  const [related, shareholders] = company
    ? await Promise.all([getRelatedCompaniesByName(client, company.name), getCompanyShareholders(client, company.id)])
    : [null, []];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-9 text-white shadow-xl shadow-brand-deep/10 md:px-8 md:py-11">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium tracking-wide text-brand-primary uppercase">
            <Network size={14} /> Inteligencia societaria y comercial
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[9px] font-semibold text-white/75">MÓDULO EN PREPARACIÓN</span>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Empresas y relaciones</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75 md:text-base">
            Descubre qué grupo está detrás de cada proyecto, qué otras empresas y proyectos están relacionados y con quién conviene iniciar una conversación.
          </p>
        </div>
      </section>

      <section aria-labelledby="relationship-value-title">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Del proyecto a la cuenta comercial</p>
          <h2 id="relationship-value-title" className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">Tres preguntas que el módulo permitirá responder</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: GitBranch,
              question: "¿Quién está detrás?",
              answer: "Identifica el grupo, empresa operativa o sociedad relacionada detrás de la SPV que aparece formalmente en el proyecto.",
              color: "bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary",
            },
            {
              icon: FolderKanban,
              question: "¿Qué cartera comparte?",
              answer: "Consolida los proyectos, MW, tecnologías, regiones y etapas de las empresas vinculadas al mismo grupo.",
              color: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
            },
            {
              icon: ContactRound,
              question: "¿Con quién conviene hablar?",
              answer: "Organiza contactos por función: desarrollo, ingeniería, conexión, permisos, compras, construcción y finanzas.",
              color: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
            },
          ].map(({ icon: Icon, question, answer, color }) => (
            <article key={question} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}><Icon size={18} /></span>
              <h3 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">{question}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 rounded-3xl border border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-white p-6 lg:grid-cols-[1fr_1.15fr] dark:via-neutral-950 dark:to-neutral-950">
        <div>
          <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Vista prevista</p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-950 dark:text-white">Una relación simple, útil y trazable</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            La experiencia priorizará la relación comercial y mostrará sólo los niveles necesarios para entender la cuenta, sin convertirla en una due diligence legal.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
            <li className="flex items-start gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-deep dark:text-brand-primary" />Cada relación conservará fuente, fecha y nivel de confianza.</li>
            <li className="flex items-start gap-2"><BriefcaseBusiness size={15} className="mt-0.5 shrink-0 text-brand-deep dark:text-brand-primary" />La unidad comercial será el grupo empresarial, no la SPV aislada.</li>
            <li className="flex items-start gap-2"><Search size={15} className="mt-0.5 shrink-0 text-brand-deep dark:text-brand-primary" />Las coincidencias de nombre no se mostrarán automáticamente como propiedad.</li>
          </ul>
        </div>
        <div className="flex flex-col justify-center rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          {[
            { label: "Grupo o matriz", icon: Building2 },
            { label: "Empresa operativa o filial", icon: BriefcaseBusiness },
            { label: "Sociedad de proyecto · SPV", icon: Fingerprint },
            { label: "Proyecto energético", icon: FolderKanban },
          ].map(({ label, icon: Icon }, index, items) => (
            <div key={label}>
              <div className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/15 text-brand-deep dark:text-brand-primary"><Icon size={15} /></span>
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{label}</span>
              </div>
              {index < items.length - 1 && <div className="ml-8 flex h-5 items-center"><ArrowRight size={14} className="rotate-90 text-neutral-400" /></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-brand-deep uppercase dark:text-brand-primary">Explorador actual</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">Consulta las relaciones disponibles</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              Hoy puedes revisar empresas y relaciones construidas desde los registros ya integrados. La consolidación societaria ampliada dependerá de la prueba y contratación de un proveedor especializado.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Cobertura en expansión</span>
        </div>
      </section>

      <form className="flex flex-wrap items-end gap-3" action="/mapa-stakeholder">
        <label className="flex min-w-[280px] flex-1 flex-col gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">Empresa / desarrollador
          <select name="empresa" defaultValue={selectedId ?? ""} className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700">
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.projectCount} proyectos</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900">Explorar relación</button>
      </form>

      {company && <PlanGate
        locked={premiumLocked}
        label="Disponible en plan Premium"
        variant="showcase"
        title="Entiende quién está detrás de cada proyecto"
        description="Explora una vista profesional de empresas, SPV, accionistas y relaciones para preparar conversaciones con más contexto."
        features={["Mapa de empresas vinculadas", "RUT e identidad consolidada", "Accionistas e inversionistas", "Trazabilidad de fuente y confianza"]}
      ><>
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Building2 size={15} /> Entidad central</div><p className="mt-2 truncate text-lg font-semibold text-neutral-900 dark:text-neutral-50">{company.name}</p></Panel>
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Fingerprint size={15} /> Identificador legal</div><p className="mt-2 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{company.rut ?? "RUT pendiente"}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">clave de consolidación societaria</p></Panel>
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><UserRoundCog size={15} /> Participaciones</div><p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{shareholders.length}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">accionistas o inversionistas identificados</p></Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <Panel className="flex flex-col gap-4">
            <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Grupo y SPV</p><h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Empresas vinculadas a {company.name}</h2></div>
            {related ? <StakeholderMap centerLabel={company.name} relatedLabels={related.relatedNames} /> : <p className="text-sm text-neutral-500 dark:text-neutral-400">Aún no encontramos SPV o empresas hermanas con coincidencia verificable en el registro del Coordinador.</p>}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Fuente de esta capa: agrupación oficial del Coordinador Eléctrico Nacional por nombre normalizado. No se presenta como propiedad accionaria.</p>
          </Panel>
          <Panel className="flex flex-col gap-4">
            <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Propiedad e inversión</p><h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Accionistas e inversionistas</h2></div>
            {shareholders.length ? <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">{shareholders.map((holder, index) => <li key={`${holder.company?.id ?? holder.person?.id}-${index}`} className="py-3 first:pt-0"><p className="font-medium text-neutral-900 dark:text-neutral-50">{holder.company?.name ?? holder.person?.name}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{holder.role}{holder.ownershipPct !== null ? ` · ${holder.ownershipPct}%` : ""}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{holder.company?.rut ? `RUT ${holder.company.rut} · ` : ""}{holder.confidenceLevel.replaceAll("_", " ")}</p></li>)}</ul> : <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><ShieldCheck size={18} className="mb-2 text-brand-primary" />Sin participaciones cargadas todavía. La estructura está preparada para consolidarlas por RUT desde fuentes oficiales y conservar porcentaje, vigencia y confianza; no inferiremos propiedad por nombres parecidos.</div>}
            <Link href="/crm" className="inline-flex items-center gap-1 self-start text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Llevar al CRM <span aria-hidden>→</span></Link>
          </Panel>
        </div>
      </></PlanGate>}
    </div>
  );
}
