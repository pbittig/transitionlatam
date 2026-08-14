import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, PencilLine, Inbox, Users, ClipboardList, TriangleAlert, Activity, ShieldAlert, FileSearch, BarChart3, Gauge, Archive } from "lucide-react";
import { countUnverifiedProjects, countNeedsReverification, countFallenProjects } from "@/lib/data-access/projects";
import { isAdmin } from "@/lib/auth/session";
import { Panel } from "../components/Panel";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getEditorialCounts } from "@/lib/data-access/editorialQueue";
import { countPertinenciasPending } from "@/lib/data-access/pertinencias";
import { CollapsibleSection } from "../components/CollapsibleSection";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) return null;
  const serviceClient = createSupabaseServiceClient();
  const [pendingResult, editorialResult, requestResult, reverificationResult, pertinenciaResult, fallenResult] = await Promise.allSettled([
    countUnverifiedProjects(serviceClient),
    getEditorialCounts(serviceClient),
    serviceClient.from("service_request").select("id", { count: "exact", head: true }).eq("status", "new"),
    countNeedsReverification(serviceClient),
    countPertinenciasPending(serviceClient),
    countFallenProjects(serviceClient),
  ]);
  const pendingCount = pendingResult.status === "fulfilled" ? pendingResult.value : null;
  const editorialCounts = editorialResult.status === "fulfilled" ? editorialResult.value : null;
  const requestCount =
    requestResult.status === "fulfilled" && !requestResult.value.error ? (requestResult.value.count ?? 0) : null;
  const reverificationCount = reverificationResult.status === "fulfilled" ? reverificationResult.value : null;
  const pertinenciaCount = pertinenciaResult.status === "fulfilled" ? pertinenciaResult.value : null;
  const fallenCount = fallenResult.status === "fulfilled" ? fallenResult.value : null;
  const hasUnavailableMetrics = pendingCount === null || editorialCounts === null || requestCount === null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Admin</h1>
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Herramientas internas de mantenimiento de datos.</p>
      </div>
      {hasUnavailableMetrics && (
        <div className="flex items-start gap-2 border-y border-neutral-200 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          <TriangleAlert size={17} className="mt-0.5 shrink-0 text-brand-deep" />
          <p>Algunos contadores no están disponibles temporalmente. Las herramientas administrativas siguen operativas.</p>
        </div>
      )}
      <CollapsibleSection title="Verificación">
          <Link href="/admin/trabajo-hoy">
            <Panel className="flex flex-col gap-2 border-brand-primary/30 hover:border-brand-primary">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <Inbox size={18} /> Trabajo de hoy
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {editorialCounts
                  ? `${editorialCounts.today.toLocaleString("es-CL")} nuevos hoy · ${editorialCounts.backlog.toLocaleString("es-CL")} en backlog.`
                  : "Contadores temporalmente no disponibles."}
              </p>
            </Panel>
          </Link>
          <Link href="/admin/verificador">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <ShieldCheck size={18} /> Verificador de proyecto
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {pendingCount === null
                  ? "Contador temporalmente no disponible."
                  : `${pendingCount.toLocaleString("es-CL")} proyectos pendientes de revisar.`}
              </p>
            </Panel>
          </Link>
          <Link href="/admin/revision-dudosos">
            <Panel className="flex flex-col gap-2 border-amber-300/50 hover:border-amber-400 dark:border-amber-800/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <ShieldAlert size={18} /> Revisión de casos dudosos
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {reverificationCount === null
                  ? "Contador temporalmente no disponible."
                  : reverificationCount === 1
                    ? "1 proyecto verificado con un cambio sospechoso."
                    : `${reverificationCount.toLocaleString("es-CL")} proyectos verificados con cambios sospechosos.`}
              </p>
            </Panel>
          </Link>
          <Link href="/admin/boveda">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <Archive size={18} /> Bóveda de proyectos caídos
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {fallenCount === null
                  ? "Contador temporalmente no disponible."
                  : `${fallenCount.toLocaleString("es-CL")} rechazados o desistidos, ocultos para los clientes.`}
              </p>
            </Panel>
          </Link>
          <Link href="/admin/pertinencias">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <FileSearch size={18} /> Pertinencias SEA
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {pertinenciaCount === null
                  ? "Contador temporalmente no disponible."
                  : pertinenciaCount === 1
                    ? "1 pertinencia por revisar."
                    : `${pertinenciaCount.toLocaleString("es-CL")} pertinencias por revisar.`}
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
      </CollapsibleSection>

      <CollapsibleSection title="Operacional">
          <Link href="/admin/operacion">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <Gauge size={18} /> Operación
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Cobertura de datos y salud de las sincronizaciones.</p>
            </Panel>
          </Link>
          <Link href="/admin/logs">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <Activity size={18} /> Automatización
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Revisa sincronizaciones, avance, duración y errores de los cron jobs.
              </p>
            </Panel>
          </Link>
      </CollapsibleSection>

      <CollapsibleSection title="Comercial">
          <Link href="/admin/metricas">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <BarChart3 size={18} /> Métricas
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Usuarios registrados, actividad y proyectos más visitados.</p>
            </Panel>
          </Link>
          <Link href="/admin/requerimientos">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <ClipboardList size={18} /> Requerimientos
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {requestCount === null
                  ? "Contador temporalmente no disponible."
                  : requestCount === 1
                    ? "1 nueva solicitud comercial."
                    : `${requestCount.toLocaleString("es-CL")} nuevas solicitudes comerciales.`}
              </p>
            </Panel>
          </Link>
      </CollapsibleSection>

      <CollapsibleSection title="Admin">
          <Link href="/admin/usuarios">
            <Panel className="flex flex-col gap-2 hover:border-neutral-300 dark:hover:border-neutral-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                <Users size={18} /> Usuarios
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">Crea cuentas, habilita accesos y asigna planes.</p>
            </Panel>
          </Link>
      </CollapsibleSection>
    </div>
  );
}
