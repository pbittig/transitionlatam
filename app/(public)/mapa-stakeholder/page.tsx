import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ContactRound, Network, Share2, ShieldCheck } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { getCompanyById, getCompanyShareholders, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { getOwnerPortfolio, getSimilarCompanyNames } from "@/lib/data-access/ownerPortfolio";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { isAdmin } from "@/lib/auth/session";
import { getAppLocale } from "@/lib/i18n";
import { formatRutForDisplay } from "@/lib/shared/formatRut";
import { formatPersonName } from "@/lib/shared/formatContact";
import { localizedRoute } from "@/lib/localizedRoutes";
import { Panel } from "../components/Panel";
import { PlanGate } from "../components/PlanGate";
import { ModuleGuide } from "../components/ModuleGuide";
import { StakeholderMap } from "../components/StakeholderMap";
import { SectionHero } from "../components/SectionHero";
import { OwnerPortfolioPanels } from "./OwnerPortfolioPanels";

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
  const [related, shareholders, portfolio, similares] = company
    ? await Promise.all([
        getRelatedCompaniesByName(client, company.name),
        getCompanyShareholders(client, company.id),
        getOwnerPortfolio(client, company.id, company.name),
        getSimilarCompanyNames(client, company.id, company.name),
      ])
    : [null, [], null, []];
  const ownerPath = localizedRoute("owners", locale);

  return (
    <div className="flex flex-col gap-6 pb-4">
      <SectionHero
        eyebrow={en ? "Company intelligence" : "Inteligencia empresarial"}
        title={en ? "Owners and companies" : "Propietarios y empresas"}
        description={en ? "Review the published project portfolio, registered legal identity and relationships supported by available sources." : "Revise la cartera de proyectos publicada, la identidad legal registrada y las relaciones respaldadas por las fuentes disponibles."}
        actions={
          <Link href={localizedRoute("obsx", locale)} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#052020] transition hover:bg-[#63e3d4]">
            <Share2 size={15} /> {en ? "Open in ObsX" : "Ver en ObsX"}
          </Link>
        }
        metrics={[
          { label: en ? "Explorable companies" : "Empresas explorables", value: companies.length.toLocaleString("es-CL"), detail: en ? "developers with a portfolio" : "desarrolladores con cartera" },
          { label: en ? "Selected company" : "Empresa seleccionada", value: company?.name ?? (en ? "No selection" : "Sin selección"), detail: en ? "verifiable identity and portfolio" : "identidad y cartera verificable" },
          ...(portfolio
            ? [{
                label: en ? "Identified capacity" : "Capacidad identificada",
                value: portfolio.totalMw >= 1000 ? `${(portfolio.totalMw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW` : `${Math.round(portfolio.totalMw).toLocaleString("es-CL")} MW`,
                detail: `${portfolio.proyectos.length} ${en ? "published projects" : "proyectos publicados"}`,
              }]
            : []),
        ]}
      />

      {false && <ModuleGuide purpose={en ? "Understand the company behind a project before starting a commercial conversation." : "Entender la empresa detrás de un proyecto antes de iniciar una conversación comercial."} deliverables={en ? ["Published project portfolio", "Registered company identity", "Available corporate relationships"] : ["Cartera de proyectos publicados", "Identidad de empresa registrada", "Relaciones societarias disponibles"]} howToUse={en ? ["Select a developer", "Review its portfolio and relationships", "Take the account to CRM"] : ["Seleccione un desarrollador", "Revise su cartera y relaciones", "Lleve la cuenta al CRM"]} plan="Prime" upgradeMessage={en ? "Prime connects company intelligence with your commercial workflow." : "Prime conecta la inteligencia empresarial con su flujo comercial."} locale={locale} />}

      <Panel className="p-4 md:p-5">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action={ownerPath}>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{en ? "Company or developer" : "Empresa o desarrollador"}
            <select name="empresa" defaultValue={company?.id ?? ""} className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-900 outline-none transition focus:border-brand-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white">
              {companies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.projectCount} {en ? "projects" : "proyectos"}</option>)}
            </select>
          </label>
          <button type="submit" className="h-11 rounded-xl bg-brand-deep px-5 text-sm font-semibold text-white transition hover:bg-brand-ink">{en ? "View company" : "Ver empresa"}</button>
        </form>
        <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{en ? "The selector lists the 40 developers with the most published projects." : "El selector muestra los 40 desarrolladores con más proyectos publicados."}</p>
      </Panel>

      {company ? (
        <PlanGate locked={premiumLocked} label={en ? "Available on Prime" : "Disponible en plan Prime"} variant="showcase">
          <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex min-w-0 items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-deep"><Building2 size={21} /></span><div className="min-w-0"><p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{en ? "Selected company" : "Empresa seleccionada"}</p><h2 className="mt-1 break-words text-xl font-semibold text-neutral-950 dark:text-white">{company.name}</h2><p className="mt-1 text-sm text-neutral-500">{company.rut ? `RUT ${formatRutForDisplay(company.rut)}` : en ? "No RUT registered" : "Sin RUT registrado"}</p></div></div>
              <Link href="/crm" className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:text-neutral-200"><ContactRound size={16} />{en ? "Add to CRM" : "Llevar al CRM"}</Link>
            </section>

            {portfolio && <OwnerPortfolioPanels portfolio={portfolio} companyName={company.name} similares={similares} locale={locale} />}

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="flex flex-col gap-4"><div className="flex items-start gap-2"><Network size={18} className="mt-0.5 shrink-0 text-brand-primary" /><div><h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{en ? "Related companies" : "Empresas relacionadas"}</h2><p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{en ? "Entities grouped with this company in the National Electricity Coordinator registry." : "Entidades agrupadas con esta empresa en el registro del Coordinador Eléctrico Nacional."}</p></div></div>{related ? <StakeholderMap centerLabel={company.name} relatedLabels={related.relatedNames} /> : <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm leading-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">{en ? "No verifiable related entities have been found in the Coordinator registry." : "No se encontraron entidades relacionadas verificables en el registro del Coordinador."}</p>}<p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{en ? "This grouping is not equity ownership." : "Esta agrupación no corresponde a propiedad accionaria."}</p></Panel>
              <Panel className="flex flex-col gap-4"><div className="flex items-start gap-2"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-brand-primary" /><div><h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{en ? "Shareholders and investors" : "Accionistas e inversionistas"}</h2><p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">{en ? "Registered ownership interests, including their role and confidence level." : "Participaciones registradas, con su rol y nivel de confianza."}</p></div></div>{shareholders.length ? <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">{shareholders.map((holder, index) => <li key={`${holder.company?.id ?? holder.person?.id}-${index}`} className="py-3 first:pt-0"><p className="font-medium text-neutral-900 dark:text-neutral-50">{holder.company ? holder.company.name : formatPersonName(holder.person?.name)}</p><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{holder.role}{holder.ownershipPct !== null ? ` · ${holder.ownershipPct}%` : ""}</p><p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{holder.company?.rut ? `RUT ${formatRutForDisplay(holder.company.rut)} · ` : ""}{holder.confidenceLevel.replaceAll("_", " ")}</p></li>)}</ul> : <p className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm leading-6 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">{en ? "No ownership interests have been loaded for this company. Ownership is not inferred from similar names or corporate groupings." : "No hay participaciones cargadas para esta empresa. La propiedad no se infiere por nombres similares ni por agrupaciones empresariales."}</p>}</Panel>
            </div>
          </div>
        </PlanGate>
      ) : <Panel className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">{en ? "No company was found for the selected record." : "No se encontró una empresa para el registro seleccionado."}</Panel>}
    </div>
  );
}
