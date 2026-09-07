import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Network, Share2, Waypoints } from "lucide-react";
import { createSupabasePageClient } from "@/lib/data-access/supabase-page-client";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getCompanyById, getTopCompaniesByProjectCount } from "@/lib/data-access/companies";
import { getObsxCompanyOptions, getObsxGlobalGraph, getObsxGraph, getObsxUniverse } from "@/lib/data-access/obsxGraph";
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

/** Valor de `vista` que abre la red consolidada de todas las sociedades vigentes. */
const VISTA_GLOBAL = "global";

export default async function ObsxPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; vista?: string }>;
}) {
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
  const esGlobal = params.vista === VISTA_GLOBAL;
  const empresaId = params.empresa ?? desarrolladoras[0]?.id;
  const company = esGlobal ? null : empresaId ? await getCompanyById(client, empresaId) : null;
  // La cadena societaria vive en tablas cerradas por RLS al usuario final, igual
  // que en la ficha de proyecto: se lee con el cliente de servicio.
  const graph = esGlobal
    ? await getObsxGlobalGraph(client, serviceClient)
    : company
      ? await getObsxGraph(client, serviceClient, company)
      : null;
  const ficha = graph?.company ?? null;
  const obsxPath = localizedRoute("obsx", locale);
  const globalPath = `${obsxPath}?vista=${VISTA_GLOBAL}`;
  const ownerPath = localizedRoute("owners", locale);

  const resumen = graph?.resumen;
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
          <Link
            href={globalPath}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-3.5 py-2 text-sm font-semibold text-[#052020] transition hover:bg-[#63e3d4]"
          >
            <Waypoints size={15} />
            {en ? "Global map of projects and companies" : "Relación global de proyectos y sociedades"}
          </Link>
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
              defaultValue={company?.id ?? ""}
              className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-900 outline-none transition focus:border-brand-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
            >
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
            <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-surface text-brand-deep">
                  <Share2 size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                    {esGlobal
                      ? en
                        ? "Consolidated network"
                        : "Red consolidada"
                      : en
                        ? "Graph centered on"
                        : "Grafo centrado en"}
                  </p>
                  <h2 className="mt-1 break-words text-xl font-semibold text-neutral-950 dark:text-white">{ficha.name}</h2>
                  <p className="mt-1 text-sm text-neutral-500">
                    {esGlobal ? (
                      <>
                        {en
                          ? `${resumen.cadenasSocietarias.toLocaleString("es-CL")} companies with vigente projects`
                          : `${resumen.cadenasSocietarias.toLocaleString("es-CL")} sociedades con proyectos vigentes`}
                      </>
                    ) : ficha.rut ? (
                      `RUT ${formatRutForDisplay(ficha.rut)}`
                    ) : en ? (
                      "No RUT registered"
                    ) : (
                      "Sin RUT registrado"
                    )}
                    {" · "}
                    {graph.nodes.length.toLocaleString("es-CL")} {en ? "nodes" : "nodos"}
                    {" · "}
                    {graph.links.length.toLocaleString("es-CL")} {en ? "relations" : "relaciones"}
                  </p>
                </div>
              </div>
              {esGlobal ? (
                <Link
                  href={obsxPath}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:text-neutral-200"
                >
                  <Building2 size={16} />
                  {en ? "Back to company view" : "Volver a la vista por empresa"}
                </Link>
              ) : (
                <Link
                  href={`${ownerPath}?empresa=${ficha.id}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:border-brand-primary hover:text-brand-deep dark:border-neutral-700 dark:text-neutral-200"
                >
                  <Network size={16} />
                  {en ? "Full company profile" : "Ver ficha completa"}
                </Link>
              )}
            </section>

            {esGlobal && (
              <p className="-mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                {en
                  ? "The canvas shows every vigente company, their interrelations and the projects hanging off each one. Use the “Companies” panel on the left to focus on the ones you care about."
                  : "El lienzo muestra todas las sociedades vigentes, su interrelación y los proyectos que cuelgan de cada una. Use el panel “Empresas” de la izquierda para enfocar las que le interesan."}
              </p>
            )}

            <ObsxCanvas graph={graph} empresasFiltrables={esGlobal} />

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
