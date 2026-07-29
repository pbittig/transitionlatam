import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowUpRight, BatteryCharging, Building2, Map, Network, Radar, UsersRound } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/data-access/supabase-server-client";
import { getConstructionStats } from "@/lib/data-access/construction";
import { getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getConnectionCalendar, getPipelineLastSyncedAt, getPipelineScopeTotals, getUpcomingScheduleInputs } from "@/lib/data-access/pipeline";
import { getLastSyncTimestamp, getPowerPlantStats } from "@/lib/data-access/powerPlants";
import { computePipelineByTechnology } from "@/lib/shared/marketSnapshot";
import { LastSyncIndicator } from "./components/LastSyncIndicator";
import { Panel } from "./components/Panel";
import { PlanGate } from "./components/PlanGate";
import { isAdmin } from "@/lib/auth/session";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";

export const metadata: Metadata = { title: "Inicio — Transition LATAM" };
export const dynamic = "force-dynamic";

function formatGw(mw: number) {
  return `${(mw / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`;
}

export default async function HomePage() {
  const client = await createSupabaseServerClient();
  const [scope, scheduleInputs, construction, operating, calendar, companies, lastSync, pipelineLastSync, admin, profile] = await Promise.all([
    getPipelineScopeTotals(client),
    getUpcomingScheduleInputs(client),
    getConstructionStats(client),
    getPowerPlantStats(client),
    getConnectionCalendar(client, 6),
    getTopCompaniesByProjectCount(client, 5),
    getLastSyncTimestamp(client),
    getPipelineLastSyncedAt(createSupabaseServiceClient()),
    isAdmin(),
    getCurrentUserProfile(client),
  ]);
  const premiumLocked = !admin && profile?.planCode !== "premium";

  const technologies = computePipelineByTechnology(scheduleInputs);
  const bess = technologies.find((item) => /bess|almacenamiento/i.test(item.category));
  const nextConnections = calendar.slice(0, 3);
  const nextConnectionMw = nextConnections.reduce((sum, item) => sum + item.capacityMw, 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-brand-primary/20 bg-gradient-to-r from-brand-ink via-brand-deep to-[#1b8d83] px-6 py-7 text-white shadow-lg shadow-brand-deep/10 md:px-8">
        <span className="absolute -top-20 right-8 h-52 w-52 rounded-full border border-white/10" aria-hidden />
        <span className="absolute -right-12 -bottom-28 h-64 w-64 rounded-full bg-brand-primary/15 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-primary uppercase">
            <Radar size={14} /> Torre de control · Chile
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">La transición, en movimiento.</h1>
          <p className="mt-2 max-w-2xl text-white/75">
            Inteligencia de mercado para la transición energética en Chile — generación, almacenamiento y data centers — para priorizar proyectos, entender quién participa y abrir conversaciones comerciales con mejor contexto.
          </p>
        </div>
        <div className="flex flex-col items-start gap-1">
          <LastSyncIndicator isoTimestamp={lastSync} label="Centrales (CNE) actualizadas" />
          <LastSyncIndicator isoTimestamp={pipelineLastSync} label="Proyectos futuros actualizados" />
        </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen del mercado">
        <Panel className="border-t-2 border-t-brand-primary p-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400"><Activity size={15} /> Pipeline vigente</div>
          <p className="mt-4 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{scope.esperados.count.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{formatGw(scope.esperados.totalCapacityMw)} por conectar</p>
          <Link href="/proyectos-esperados" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Abrir monitor <ArrowUpRight size={15} /></Link>
        </Panel>
        <Panel className="border-t-2 border-t-data-bess p-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400"><BatteryCharging size={15} /> Almacenamiento</div>
          <p className="mt-4 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{bess?.count.toLocaleString("es-CL") ?? "—"}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">proyectos BESS en pipeline</p>
          <Link href="/proyectos-esperados?tech=bess" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Ver BESS <ArrowUpRight size={15} /></Link>
        </Panel>
        <Panel className="border-t-2 border-t-data-solar p-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400"><Building2 size={15} /> En construcción</div>
          <p className="mt-4 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{construction.count.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{formatGw(construction.totalPotenciaMw)} declarados por CNE</p>
          <Link href="/mercado" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Ver mercado <ArrowUpRight size={15} /></Link>
        </Panel>
        <Panel className="border-t-2 border-t-data-blue p-4">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-500 dark:text-neutral-400"><Map size={15} /> Parque operativo</div>
          <p className="mt-4 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{formatGw(operating.operatingCapacityMw)}</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">capacidad instalada registrada</p>
          <Link href="/mercado" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Explorar centrales <ArrowUpRight size={15} /></Link>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <Panel className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Próxima ventana</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Conexiones próximas</h2>
          </div>
          <p className="text-3xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{formatGw(nextConnectionMw)}</p>
          <p className="-mt-3 text-sm text-neutral-500 dark:text-neutral-400">programados en los próximos meses</p>
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {nextConnections.map((entry) => (
              <li key={entry.yearMonth} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-medium text-neutral-800 dark:text-neutral-100">{new Date(`${entry.yearMonth}-01T12:00:00`).toLocaleDateString("es-CL", { month: "short", year: "numeric" })}</span>
                <span className="text-neutral-500 dark:text-neutral-400">{Math.round(entry.capacityMw).toLocaleString("es-CL")} MW · {entry.count} proyectos</span>
              </li>
            ))}
          </ul>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">Relaciones</p><h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-50">Desarrolladores con mayor cartera</h2></div>
            <Network size={18} className="text-brand-primary" />
          </div>
          <PlanGate locked={premiumLocked} label="Disponible en plan Premium">
            <ol className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {companies.map((company, index) => (
                <li key={company.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-5 text-sm tabular-nums text-neutral-400 dark:text-neutral-500">{index + 1}</span>
                  <Link href={`/mapa-stakeholder?empresa=${company.id}`} className="min-w-0 flex-1 truncate font-medium text-neutral-900 hover:text-brand-primary dark:text-neutral-50">{company.name}</Link>
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">{company.projectCount} proyectos</span>
                </li>
              ))}
            </ol>
          </PlanGate>
          <Link href="/mapa-stakeholder" className="inline-flex items-center gap-1 self-start text-sm font-medium text-neutral-700 hover:text-brand-primary dark:text-neutral-200">Explorar relaciones <ArrowUpRight size={15} /></Link>
        </Panel>

        <Panel className="flex flex-col justify-between gap-6 border-brand-primary/25 bg-gradient-to-br from-brand-surface via-white to-brand-primary/10 dark:via-neutral-900 dark:to-brand-primary/5">
          <div>
            <UsersRound size={20} className="text-brand-primary" />
            <p className="mt-4 text-xs font-medium tracking-wide text-neutral-500 uppercase dark:text-neutral-400">De los datos a la inteligencia de mercado</p>
            <h2 className="mt-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">Ubica al proyecto, a la empresa y a las personas detrás.</h2>
            <p className="mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">Consulta contactos extraídos de fuentes públicas junto con la cartera de cada desarrollador para preparar mejor el siguiente paso comercial.</p>
          </div>
          {premiumLocked ? (
            <div className="flex flex-col gap-1.5">
              <span
                title="Disponible en plan Premium"
                className="inline-flex w-fit cursor-not-allowed items-center gap-1 rounded-lg bg-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500"
              >
                Abrir contactos <ArrowUpRight size={16} />
              </span>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Los contactos y el CRM están incluidos en Premium.</p>
            </div>
          ) : (
            <Link href="/crm" className="inline-flex w-fit items-center gap-1 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900">Abrir contactos <ArrowUpRight size={16} /></Link>
          )}
        </Panel>
      </section>
    </div>
  );
}
