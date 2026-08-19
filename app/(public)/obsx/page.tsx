import type { Metadata } from "next";
import Link from "next/link";
import { BatteryCharging, Building2, CalendarClock, ContactRound, Info, Network, Share2, Sparkles } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getCompanyById, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getObsxCompanyOptions, getObsxGraph, getObsxUniverse } from "@/lib/data-access/obsxGraph";
import { getObsxDemoGraph } from "@/lib/data-access/obsxDemoGraph";
import { getCurrentUserProfile } from "@/lib/data-access/userProfile";
import { isAdmin } from "@/lib/auth/session";
import { getAppLocale } from "@/lib/i18n";
import { formatRutForDisplay } from "@/lib/shared/formatRut";
import { localizedRoute } from "@/lib/localizedRoutes";
import { Panel } from "../components/Panel";
import { PlanGate } from "../components/PlanGate";
import { SectionHero } from "../components/SectionHero";
import { ObsxCanvas } from "./ObsxCanvas";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getAppLocale();
  return { title: locale === "en" ? "ObsX — Intelligence Graph" : "ObsX — Grafo de inteligencia" };
}

export const dynamic = "force-dynamic";

/** Cuántas empresas ofrece el selector. Son las mismas del selector de Propietarios, con más fondo. */
const EMPRESAS_EN_SELECTOR = 120;

/** Valor del selector que abre la maqueta con datos inventados (ver obsxDemoGraph.ts). */
const DEMO_ID = "demo";

function compactMw(valor: number): string {
  if (valor >= 1000) return `${(valor / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`;
  return `${Math.round(valor).toLocaleString("es-CL")} MW`;
}

function TarjetaHorizonte({
  icono,
  titulo,
  valor,
  detalle,
  acento,
}: {
  icono: React.ReactNode;
  titulo: string;
  valor: string;
  detalle: string;
  acento: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: acento }} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{titulo}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-deep">{icono}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-neutral-950 tabular-nums dark:text-white">{valor}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{detalle}</p>
    </article>
  );
}

export default async function ObsxPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const locale = await getAppLocale();
  const en = locale === "en";
  const params = await searchParams;
  const client = await createSupabasePageClient();
  const admin = await isAdmin();
  const profile = admin ? null : await getCurrentUserProfile(client);
  const premiumLocked = !admin && profile?.planCode !== "premium";

  const serviceClient = createSupabaseServiceClient();
  const [desarrolladoras, universo] = await Promise.all([
    getTopCompaniesByProjectCount(client, EMPRESAS_EN_SELECTOR),
    getObsxUniverse(client, serviceClient),
  ]);
  const opciones = await getObsxCompanyOptions(client, serviceClient, desarrolladoras);
  const esDemo = params.empresa === DEMO_ID;
  const empresaId = params.empresa ?? desarrolladoras[0]?.id;
  const company = esDemo ? null : empresaId ? await getCompanyById(client, empresaId) : null;
  // La cadena societaria vive en tablas cerradas por RLS al usuario final, igual
  // que en la ficha de proyecto: se lee con el cliente de servicio.
  const graph = esDemo ? getObsxDemoGraph() : company ? await getObsxGraph(client, serviceClient, company) : null;
  const ficha = graph?.company ?? null;
  const obsxPath = localizedRoute("obsx", locale);
  const ownerPath = localizedRoute("owners", locale);

  const resumen = graph?.resumen;
  const participaciones = graph?.links.filter((l) => l.kind === "controla").length ?? 0;
  const totalOmitidos = graph
    ? Object.values(graph.omitidos).reduce((suma, valor) => suma + valor, 0)
    : 0;

  return (
    <div className="flex flex-col gap-6 pb-4">
      <SectionHero
        eyebrow={en ? "Relational intelligence" : "Inteligencia relacional"}
        title="ObsX"
        titleSuffix={en ? "Intelligence Graph" : "Grafo de inteligencia"}
        description={
          en
            ? "See how companies, related entities, pipeline projects and operating assets connect on a single canvas — and where each connection comes from."
            : "Vea en un solo lienzo cómo se conectan las empresas, sus sociedades, los proyectos futuros y los activos que ya operan — y de dónde sale cada conexión."
        }
        actions={
          <>
            <Link
              href={ownerPath}
              className="inline-flex items-center gap-2 rounded-lg border border-white/18 bg-white/5 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-white/10"
            >
              <Building2 size={15} /> {en ? "Company profile" : "Ficha de la empresa"}
            </Link>
            <Link
              href="/crm"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#052020] transition hover:bg-[#63e3d4]"
            >
              <ContactRound size={15} /> {en ? "Take to CRM" : "Llevar al CRM"}
            </Link>
          </>
        }
        metrics={[
          { label: en ? "Companies" : "Empresas", value: universo.empresas.toLocaleString("es-CL"), detail: en ? "in the registry" : "en el registro" },
          { label: en ? "Pipeline projects" : "Proyectos futuros", value: universo.proyectos.toLocaleString("es-CL"), detail: en ? "published, with developer" : "publicados con desarrollador" },
          { label: en ? "Operating plants" : "Centrales en operación", value: universo.centrales.toLocaleString("es-CL"), detail: en ? "CNE registry" : "registro de la CNE" },
          { label: en ? "Coordinator groups" : "Empresas agrupadas", value: universo.gruposCoordinador.toLocaleString("es-CL"), detail: en ? "with a Coordinator group" : "con grupo del Coordinador" },
          { label: en ? "Verified ownership" : "Fichas societarias", value: universo.fichasSocietarias.toLocaleString("es-CL"), detail: en ? "projects with a chain loaded" : "proyectos con cadena cargada" },
        ]}
      />

      <Panel className="p-4 md:p-5">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action={obsxPath}>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
            {en ? "Center the graph on" : "Centrar el grafo en"}
            <select
              name="empresa"
              defaultValue={esDemo ? DEMO_ID : (company?.id ?? "")}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-900 outline-none transition focus:border-brand-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
              <optgroup label={en ? "Preview" : "Vista de ejemplo"}>
                <option value={DEMO_ID}>
                  {en
                    ? "Cordillera Energy Group — fictional data"
                    : "Grupo Energético Cordillera — datos ficticios"}
                </option>
              </optgroup>
              {opciones.conCadenaSocietaria.length > 0 && (
                <optgroup label={en ? "With a verified ownership chain" : "Con cadena societaria verificada"}>
                  {opciones.conCadenaSocietaria.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={en ? "Developers by portfolio size" : "Desarrolladoras por tamaño de cartera"}>
                {opciones.desarrolladoras.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.projectCount} {en ? "projects" : "proyectos"}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            type="submit"
            className="h-11 rounded-xl bg-brand-deep px-5 text-sm font-semibold text-white transition hover:bg-brand-ink"
          >
            {en ? "Explore" : "Explorar"}
          </button>
        </form>
        <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          {en
            ? `The selector lists the companies whose projects already have a verified ownership chain, plus the ${EMPRESAS_EN_SELECTOR} developers with the most published projects. Inside the canvas you can search, filter and drag any node.`
            : `El selector muestra primero las empresas cuyos proyectos ya tienen cadena societaria verificada, y después los ${EMPRESAS_EN_SELECTOR} desarrolladores con más proyectos publicados. Dentro del lienzo puede buscar, filtrar y mover cualquier nodo.`}
        </p>
      </Panel>

      {graph && ficha && resumen ? (
        <PlanGate locked={premiumLocked} label={en ? "Available on Prime" : "Disponible en plan Prime"} variant="showcase">
          <div className="flex flex-col gap-6">
            {graph.esEjemplo && (
              // Mismo rótulo que la relación societaria de Propietarios: cuando
              // los datos son inventados, se dice en la propia superficie.
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-900 uppercase dark:bg-amber-950 dark:text-amber-200">
                  Ejemplo ficticio
                </span>
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  Nombres, RUT, potencias y porcentajes inventados. Es la forma que tendrá ObsX cuando se integre la API
                  de sociedades — hoy ninguna empresa real tiene esta estructura cargada.
                </p>
              </div>
            )}

            <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-deep">
                  <Share2 size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                    {en ? "Graph centered on" : "Grafo centrado en"}
                  </p>
                  <h2 className="mt-1 break-words text-xl font-semibold text-neutral-950 dark:text-white">{ficha.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {ficha.rut
                      ? `RUT ${graph.esEjemplo ? ficha.rut : formatRutForDisplay(ficha.rut)}`
                      : en
                        ? "No RUT registered"
                        : "Sin RUT registrado"}
                    {" · "}
                    {graph.nodes.length.toLocaleString("es-CL")} {en ? "nodes" : "nodos"}
                    {" · "}
                    {graph.links.length.toLocaleString("es-CL")} {en ? "relations" : "relaciones"}
                  </p>
                </div>
              </div>
              {!graph.esEjemplo && (
                <Link
                  href={`${ownerPath}?empresa=${ficha.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:text-neutral-200"
                >
                  <Network size={16} />
                  {en ? "Full company profile" : "Ver ficha completa"}
                </Link>
              )}
            </section>

            <ObsxCanvas graph={graph} />

            {totalOmitidos > 0 && (
              <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-3 text-xs leading-5 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                El lienzo dibuja las ramas más grandes de cada tipo. Quedaron fuera{" "}
                {[
                  graph.omitidos.proyectos && `${graph.omitidos.proyectos} proyectos`,
                  graph.omitidos.activos && `${graph.omitidos.activos} centrales`,
                  graph.omitidos.construccion && `${graph.omitidos.construccion} obras`,
                  graph.omitidos.razonesSociales && `${graph.omitidos.razonesSociales} razones sociales`,
                  graph.omitidos.relacionadas && `${graph.omitidos.relacionadas} empresas relacionadas`,
                ]
                  .filter(Boolean)
                  .join(", ")}
                . Los totales de esta página sí los consideran.
              </p>
            )}

            <section className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
                  {en ? "Present and future" : "Presente y futuro"}
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Lo que {ficha.name} ya opera, lo que está construyendo y lo que todavía es cartera. Es la
                  comparación que una tabla por separado no deja ver.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <TarjetaHorizonte
                  icono={<Building2 size={15} />}
                  titulo="En operación"
                  valor={compactMw(resumen.operacionMw)}
                  detalle={`${resumen.operacionCount.toLocaleString("es-CL")} centrales del registro de la CNE`}
                  acento="#38d7c5"
                />
                <TarjetaHorizonte
                  icono={<CalendarClock size={15} />}
                  titulo="En construcción"
                  valor={compactMw(resumen.construccionMw)}
                  detalle={`${resumen.construccionCount.toLocaleString("es-CL")} obras declaradas ante la CNE`}
                  acento="#2a78d6"
                />
                <TarjetaHorizonte
                  icono={<Sparkles size={15} />}
                  titulo="En cartera"
                  valor={compactMw(resumen.pipelineMw)}
                  detalle={`${resumen.pipelineCount.toLocaleString("es-CL")} proyectos publicados`}
                  acento="#9085e9"
                />
                <TarjetaHorizonte
                  icono={<BatteryCharging size={15} />}
                  titulo="BESS en cartera"
                  valor={compactMw(resumen.bessMw)}
                  detalle={
                    resumen.bessMwh > 0
                      ? `${resumen.bessCount} proyectos · ${Math.round(resumen.bessMwh).toLocaleString("es-CL")} MWh`
                      : `${resumen.bessCount} proyectos de almacenamiento`
                  }
                  acento="#9085e9"
                />
              </div>
              {resumen.operacionMw > 0 && resumen.pipelineMw > 0 && (
                <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-50">{ficha.name}</span> opera hoy{" "}
                  {compactMw(resumen.operacionMw)} y tiene {compactMw(resumen.pipelineMw)} en cartera:{" "}
                  {(resumen.pipelineMw / resumen.operacionMw).toLocaleString("es-CL", { maximumFractionDigits: 1 })} veces
                  lo que ya tiene operando, repartido en {resumen.regiones.length}{" "}
                  {resumen.regiones.length === 1 ? "región" : "regiones"}.
                </p>
              )}
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel className="flex flex-col gap-4">
                <div className="flex items-start gap-2">
                  <Sparkles size={18} className="mt-0.5 shrink-0 text-brand-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Oportunidades detectadas</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                      {graph.esEjemplo
                        ? "En la vista de ejemplo salen de la maqueta; con datos reales se calculan sobre la cartera de la empresa."
                        : "Calculadas sobre la cartera de esta empresa, no sobre estimaciones."}
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-3 text-sm">
                  <li className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-3 dark:border-neutral-900">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      Proyectos con conexión estimada dentro de 12 meses
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {resumen.proximosCount} · {compactMw(resumen.proximosMw)}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-3 dark:border-neutral-900">
                    <span className="text-neutral-600 dark:text-neutral-300">Obras ya declaradas en construcción</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {resumen.construccionCount} · {compactMw(resumen.construccionMw)}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-3 dark:border-neutral-900">
                    <span className="text-neutral-600 dark:text-neutral-300">Almacenamiento en cartera</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {resumen.bessCount} · {compactMw(resumen.bessMw)}
                    </span>
                  </li>
                  <li className="flex items-baseline justify-between gap-4">
                    <span className="text-neutral-600 dark:text-neutral-300">
                      Empresas del mismo grupo del Coordinador todavía sin explorar
                    </span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                      {resumen.relacionadas}
                    </span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={
                      graph.esEjemplo
                        ? localizedRoute("projects", locale)
                        : `${localizedRoute("projects", locale)}?q=${encodeURIComponent(ficha.name)}`
                    }
                    className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-semibold text-white hover:bg-brand-ink"
                  >
                    Ver proyectos
                  </Link>
                  <Link
                    href="/crm"
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:text-neutral-200"
                  >
                    Agregar al CRM
                  </Link>
                </div>
              </Panel>

              <Panel className="flex flex-col gap-4">
                <div className="flex items-start gap-2">
                  <Info size={18} className="mt-0.5 shrink-0 text-brand-primary" />
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Qué afirma cada línea</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                      El lienzo distingue tres niveles de certeza y nunca los mezcla.
                    </p>
                  </div>
                </div>
                <dl className="flex flex-col gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-neutral-900 dark:text-neutral-50">
                      Propiedad verificada · {participaciones}{" "}
                      {participaciones === 1 ? "participación" : "participaciones"} en{" "}
                      {resumen.cadenasSocietarias} {resumen.cadenasSocietarias === 1 ? "cadena" : "cadenas"}
                    </dt>
                    <dd className="mt-1 leading-6 text-neutral-500 dark:text-neutral-400">
                      Participaciones con porcentaje, tomadas de la ficha societaria del proyecto. Es lo único que ObsX
                      afirma como propiedad.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900 dark:text-neutral-50">Vínculo operativo</dt>
                    <dd className="mt-1 leading-6 text-neutral-500 dark:text-neutral-400">
                      Quién desarrolla, opera o construye. La cartera sale del registro de proyectos; las centrales y las
                      obras se atan por coincidencia exacta de razón social con la CNE, no por parecido de nombre.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900 dark:text-neutral-50">
                      Agrupación declarada · {resumen.relacionadas + resumen.razonesSociales} nodos
                    </dt>
                    <dd className="mt-1 leading-6 text-neutral-500 dark:text-neutral-400">
                      Empresas del mismo grupo del Coordinador Eléctrico Nacional y otras razones sociales vinculadas a
                      la empresa. Muchas son variantes del mismo nombre o cambios de marca:{" "}
                      <span className="font-medium">no son filiales ni participación accionaria</span>.
                    </dd>
                  </div>
                </dl>
                <p className="border-t border-neutral-200 pt-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                  {graph.esEjemplo
                    ? "Esta vista dibuja la cadena completa —personas, matriz, filiales y SPV— porque los datos son inventados. Con datos reales solo se dibujan las participaciones que constan en una fuente verificada."
                    : "Todavía no hay ninguna participación accionaria registrada fuera de las fichas societarias verificadas. Cuando se integre la API de sociedades, esas cadenas dejan de ser la excepción y el grafo crece por ahí."}
                </p>
              </Panel>
            </div>
          </div>
        </PlanGate>
      ) : (
        <Panel className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {en ? "No company was found for the selected record." : "No se encontró una empresa para el registro seleccionado."}
        </Panel>
      )}
    </div>
  );
}
