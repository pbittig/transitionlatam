import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Fingerprint, Network, ShieldCheck, UserRoundCog } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getCompanyById, getCompanyShareholders, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getRelatedCompaniesByName } from "@/lib/data-access/coordinadorEmpresas";
import { Panel } from "../components/Panel";
import { StakeholderMap } from "../components/StakeholderMap";

export const metadata: Metadata = { title: "Relaciones corporativas" };
export const dynamic = "force-dynamic";

export default async function MapaStakeholderPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const params = await searchParams;
  const client = await createSupabaseServerClient();
  const companies = await getTopCompaniesByProjectCount(client, 40);
  const selectedId = params.empresa ?? companies[0]?.id;
  const company = selectedId ? await getCompanyById(client, selectedId) : null;
  const [related, shareholders] = company
    ? await Promise.all([getRelatedCompaniesByName(client, company.name), getCompanyShareholders(client, company.id)])
    : [null, []];

  return (
    <div className="flex flex-col gap-8">
      <section className="border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400"><Network size={14} className="text-brand-primary" /> Inteligencia societaria</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl dark:text-neutral-50">Relaciones corporativas</h1>
        <p className="mt-2 max-w-3xl text-neutral-600 dark:text-neutral-400">Conecta proyectos, SPV, grupos empresariales, accionistas e inversionistas. El RUT es la llave para consolidar identidades; cada participación conserva su fuente y nivel de confianza.</p>
      </section>

      <form className="flex flex-wrap items-end gap-3" action="/mapa-stakeholder">
        <label className="flex min-w-[280px] flex-1 flex-col gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">Empresa / desarrollador
          <select name="empresa" defaultValue={selectedId ?? ""} className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-neutral-700">
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.projectCount} proyectos</option>)}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900">Explorar relación</button>
      </form>

      {company && <>
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
      </>}
    </div>
  );
}
