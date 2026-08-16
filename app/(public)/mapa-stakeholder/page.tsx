import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ContactRound, Fingerprint, FolderKanban, GitBranch, Network, ShieldCheck, UserRoundCog } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { getCompanyById, getCompanyShareholders, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { Panel } from "../components/Panel";
import { StakeholderMap } from "../components/StakeholderMap";
import { PlanGate } from "../components/PlanGate";
import { isAdmin } from "@/lib/auth/session";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { ModuleGuide } from "../components/ModuleGuide";
import { FreeFeaturePreview } from "../components/FreeFeaturePreview";
import { OwnershipNetworkPreview } from "./OwnershipNetworkPreview";
import { getAppLocale } from "@/lib/i18n";
import { formatRutForDisplay } from "@/lib/shared/formatRut";
import { formatPersonName } from "@/lib/shared/formatContact";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "Owners" : "Propietarios" };
}
export const dynamic = "force-dynamic";

export default async function MapaStakeholderPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const locale = await getAppLocale();
  const en = locale === "en";
  const params = await searchParams;
  const client = await createSupabasePageClient();
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] px-6 py-9 text-white shadow-xl shadow-black/10 md:px-8 md:py-11">
        <span className="absolute -top-20 right-10 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-10 -bottom-24 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{en ? "Owners" : "Propietarios"}</h1>
        </div>
      </section>

      <ModuleGuide
        purpose={en ? "Move from the formal name of an SPV to a commercial view of the company, ownership and portfolio behind each project." : "Pasar del nombre formal de una SPV a una visión comercial de la empresa, el grupo y la cartera que existe detrás de cada proyecto."}
        deliverables={en ? ["Companies, SPVs and related projects", "Available legal identity and corporate relationships", "Context to prepare a commercial conversation"] : ["Empresas, SPV y proyectos relacionados", "Identidad legal y relaciones societarias disponibles", "Contexto para preparar una conversación comercial"]}
        howToUse={en ? ["Select a company or developer", "Review its ownership and linked projects", "Add the priority account to the CRM"] : ["Seleccione una empresa o desarrollador", "Revise su grupo y proyectos vinculados", "Incorpore la cuenta prioritaria al CRM"]}
        plan="Prime"
        upgradeMessage={en ? "Prime connects corporate intelligence with the CRM and opportunities." : "Prime conecta la inteligencia societaria con el CRM y las oportunidades."}
        locale={locale}
      />

      <section aria-labelledby="relationship-value-title">
        <div>
          <h2 id="relationship-value-title" className="text-xl font-semibold text-neutral-950 dark:text-white">{en ? "Three questions this section will answer" : "Tres preguntas que la sección permitirá responder"}</h2>
          <p className="mt-2 text-sm text-neutral-500">{en ? "Connect each project's legal identity with the corporate and commercial structure behind it." : "Conecta la identidad legal de cada proyecto con la estructura empresarial y comercial que existe detrás."}</p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: GitBranch,
              question: en ? "Owners" : "Propietarios",
              answer: en ? "Identify the group, operating company or related entity behind the SPV formally listed for the project." : "Identifique el grupo, empresa operativa o sociedad relacionada detrás de la SPV que aparece formalmente en el proyecto.",
              color: "bg-brand-surface text-brand-deep dark:bg-brand-primary/10 dark:text-brand-primary",
            },
            {
              icon: FolderKanban,
              question: en ? "Related projects" : "Proyectos relacionados",
              answer: en ? "Consolidate projects, MW, technologies, regions and stages of companies linked to the same owners." : "Consolida los proyectos, MW, tecnologías, regiones y etapas de las empresas vinculadas al mismo grupo.",
              color: "bg-brand-surface text-brand-deep",
            },
            {
              icon: ContactRound,
              question: en ? "Who to contact" : "A quién contactar",
              answer: en ? "Organize contacts by role: development, engineering, connection, permitting, procurement, construction and finance." : "Organice contactos por función: desarrollo, ingeniería, conexión, permisos, compras, construcción y finanzas.",
              color: "bg-brand-primary/15 text-brand-deep",
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

      {premiumLocked && (
        <FreeFeaturePreview
          locale={locale}
          wide
          title={en ? "See how a project's partners and shareholders are identified" : "Así se identifican los socios y accionistas de un proyecto"}
          description={en ? "The section connects each project with its legal entity and the available ownership interests held by partners or shareholders." : "La sección conecta el proyecto con su sociedad titular y las participaciones disponibles de socios o accionistas."}
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[0.9fr_1fr_1.1fr]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold text-brand-deep">{en ? "PROJECT STRUCTURE · FICTIONAL EXAMPLE" : "ESTRUCTURA DEL PROYECTO · EJEMPLO FICTICIO"}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900"><p className="text-xs text-neutral-500">{en ? "Project company · SPV" : "Sociedad del proyecto · SPV"}</p><p className="mt-1 font-semibold text-neutral-900 dark:text-white">Horizonte Solar SpA</p></div>
                <div className="ownership-connector mx-auto h-4 w-px border-l-2 border-dashed border-brand-primary" />
                <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900"><p className="text-xs text-neutral-500">{en ? "Energy project" : "Proyecto energético"}</p><p className="mt-1 font-semibold text-neutral-900 dark:text-white">Parque Solar Horizonte · 180 MW</p></div>
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center gap-2"><UserRoundCog size={17} className="text-brand-primary" /><div><p className="font-semibold text-neutral-950 dark:text-white">{en ? "Shareholders of Horizonte Solar SpA" : "Accionistas de Horizonte Solar SpA"}</p><p className="mt-1 text-xs text-neutral-500">{en ? "Direct ownership interest in the project SPV" : "Participación directa en la SPV del proyecto"}</p></div></div>
              <div className="mt-4 divide-y divide-neutral-100 text-sm dark:divide-neutral-800">
                <div className="flex items-center justify-between gap-4 py-3 first:pt-0"><div><p className="font-medium text-neutral-900 dark:text-white">Inversiones Cordillera S.A.</p><p className="mt-1 text-xs text-neutral-500">{en ? "Fictional RUT 99.999.991-3 · Controlling shareholder" : "RUT ficticio 99.999.991-3 · Accionista controlador"}</p></div><span className="rounded-md bg-brand-surface px-2 py-1 text-xs font-semibold text-brand-deep">70%</span></div>
                <div className="flex items-center justify-between gap-4 py-3"><div><p className="font-medium text-neutral-900 dark:text-white">Fondo Infraestructura Sur SpA</p><p className="mt-1 text-xs text-neutral-500">{en ? "Fictional RUT 99.999.992-1 · Minority shareholder" : "RUT ficticio 99.999.992-1 · Accionista minoritario"}</p></div><span className="rounded-md bg-brand-surface px-2 py-1 text-xs font-semibold text-brand-deep">30%</span></div>
              </div>
              <p className="mt-3 border-t border-neutral-100 pt-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800">{en ? "Real relationships include their source and confidence level when available." : "Las relaciones reales incluyen su fuente y nivel de confianza cuando esa información está disponible."}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 lg:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2"><Network size={17} className="text-brand-primary" /><div><p className="font-semibold text-neutral-950 dark:text-white">{en ? "Shared portfolio" : "Cartera compartida"}</p><p className="mt-1 text-xs text-neutral-500">{en ? "Other projects linked to the shareholders" : "Otros proyectos vinculados a los accionistas"}</p></div></div>
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="rounded-lg bg-brand-surface p-3 font-semibold text-neutral-900">Inversiones Cordillera S.A.</div>
                  <div className="ownership-connector mx-auto h-4 w-px border-l-2 border-dashed border-brand-primary" />
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center dark:border-neutral-800 dark:bg-neutral-900"><p className="font-semibold text-neutral-900 dark:text-white">BESS Cordillera Central</p><p className="mt-1 text-neutral-500">120 MW / 480 MWh</p></div>
                </div>
                <div>
                  <div className="rounded-lg bg-brand-surface p-3 font-semibold text-neutral-900">Fondo Infraestructura Sur SpA</div>
                  <div className="mx-auto h-4 w-px border-l-2 border-dashed border-brand-primary" />
                  <div className="mx-8 border-t-2 border-dashed border-brand-primary" />
                  <div className="grid grid-cols-2 gap-3">
                    <div><div className="ownership-connector mx-auto h-4 w-px border-l-2 border-dashed border-brand-primary" /><div className="h-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center dark:border-neutral-800 dark:bg-neutral-900"><p className="font-semibold text-neutral-900 dark:text-white">PFV Desierto Claro</p><p className="mt-1 text-neutral-500">160 MW Solar</p></div></div>
                    <div><div className="ownership-connector mx-auto h-4 w-px border-l-2 border-dashed border-brand-primary" /><div className="h-full rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center dark:border-neutral-800 dark:bg-neutral-900"><p className="font-semibold text-neutral-900 dark:text-white">Proyecto Híbrido Altiplano</p><p className="mt-1 text-neutral-500">200 MW Solar + 80 MW / 320 MWh BESS</p></div></div>
                  </div>
                </div>
              </div>
            </div>
            <OwnershipNetworkPreview locale={locale} />
          </div>
        </FreeFeaturePreview>
      )}

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">{en ? "Review available relationships" : "Consulte las relaciones disponibles"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500 dark:text-neutral-400">
              {en ? "Review companies and relationships built from the records already integrated. Expanded corporate consolidation will depend on testing and engaging a specialized provider." : "Hoy puedes revisar empresas y relaciones construidas desde los registros ya integrados. La consolidación societaria ampliada dependerá de la prueba y contratación de un proveedor especializado."}
            </p>
          </div>
          <span className="rounded-full bg-brand-surface px-3 py-1.5 text-[10px] font-semibold text-brand-deep">{en ? "Coverage expanding" : "Cobertura en expansión"}</span>
        </div>
      </section>

      <form className="flex flex-wrap items-end gap-3" action="/propietarios">
        <label className="flex min-w-[280px] flex-1 flex-col gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">{en ? "Company / developer" : "Empresa / desarrollador"}
          <select name="empresa" defaultValue={selectedId ?? ""} className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700">
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.projectCount} {en ? "projects" : "proyectos"}</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900">{en ? "Explore relationship" : "Explorar relación"}</button>
      </form>

      {company && <PlanGate
        locked={premiumLocked}
        label={en ? "Available on Prime" : "Disponible en plan Prime"}
        variant="showcase"
        title={en ? "Understand who is behind each project" : "Entiende quién está detrás de cada proyecto"}
        description={en ? "Explore a professional view of companies, SPVs, shareholders and relationships to prepare better-informed conversations." : "Explora una vista profesional de empresas, SPV, accionistas y relaciones para preparar conversaciones con más contexto."}
        features={en ? ["Linked company map", "Consolidated RUT and identity", "Shareholders and investors", "Source and confidence traceability"] : ["Mapa de empresas vinculadas", "RUT e identidad consolidada", "Accionistas e inversionistas", "Trazabilidad de fuente y confianza"]}
      ><>
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Building2 size={15} /> {en ? "Central entity" : "Entidad central"}</div><p className="mt-2 truncate text-lg font-semibold text-neutral-900 dark:text-neutral-50">{company.name}</p></Panel>
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><Fingerprint size={15} /> {en ? "Legal identifier" : "Identificador legal"}</div><p className="mt-2 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{formatRutForDisplay(company.rut) ?? (en ? "RUT pending" : "RUT pendiente")}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{en ? "corporate consolidation key" : "clave de consolidación societaria"}</p></Panel>
          <Panel className="p-4"><div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400"><UserRoundCog size={15} /> {en ? "Ownership interests" : "Participaciones"}</div><p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{shareholders.length}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{en ? "identified shareholders or investors" : "accionistas o inversionistas identificados"}</p></Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <Panel className="flex flex-col gap-4">
            <div><h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{en ? `Companies linked to ${company.name}` : `Empresas vinculadas a ${company.name}`}</h2><p className="mt-1 text-sm text-neutral-500">{en ? "Relationships identified between the group, its entities and projects." : "Relaciones identificadas entre el grupo, sus sociedades y proyectos."}</p></div>
            {related ? <StakeholderMap centerLabel={company.name} relatedLabels={related.relatedNames} /> : <p className="text-sm text-neutral-500 dark:text-neutral-400">{en ? "No SPVs or related companies with a verifiable match have been found in the Coordinator's registry yet." : "Aún no encontramos SPV o empresas hermanas con coincidencia verificable en el registro del Coordinador."}</p>}
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{en ? "Source: official National Electricity Coordinator grouping by normalized name. It is not presented as equity ownership." : "Fuente de esta capa: agrupación oficial del Coordinador Eléctrico Nacional por nombre normalizado. No se presenta como propiedad accionaria."}</p>
          </Panel>
          <Panel className="flex flex-col gap-4">
            <div><h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{en ? "Shareholders and investors" : "Accionistas e inversionistas"}</h2><p className="mt-1 text-sm text-neutral-500">{en ? "Recorded ownership interests with their source and confidence level." : "Participaciones registradas con su fuente y nivel de confianza."}</p></div>
            {shareholders.length ? <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">{shareholders.map((holder, index) => <li key={`${holder.company?.id ?? holder.person?.id}-${index}`} className="py-3 first:pt-0"><p className="font-medium text-neutral-900 dark:text-neutral-50">{holder.company ? holder.company.name : formatPersonName(holder.person?.name)}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{holder.role}{holder.ownershipPct !== null ? ` · ${holder.ownershipPct}%` : ""}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{holder.company?.rut ? `RUT ${formatRutForDisplay(holder.company.rut)} · ` : ""}{holder.confidenceLevel.replaceAll("_", " ")}</p></li>)}</ul> : <div className="rounded-lg border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400"><ShieldCheck size={18} className="mb-2 text-brand-primary" />{en ? "No ownership interests have been loaded yet. The structure is ready to consolidate them by RUT from official sources while preserving percentage, validity and confidence; ownership will not be inferred from similar names." : "Sin participaciones cargadas todavía. La estructura está preparada para consolidarlas por RUT desde fuentes oficiales y conservar porcentaje, vigencia y confianza; no inferiremos propiedad por nombres parecidos."}</div>}
            <Link href="/crm" className="inline-flex items-center gap-1 self-start text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">{en ? "Add to CRM" : "Llevar al CRM"} <span aria-hidden>→</span></Link>
          </Panel>
        </div>
      </></PlanGate>}
    </div>
  );
}
