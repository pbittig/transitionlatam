import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { Panel } from "../../components/Panel";
import { SERVICE_LABELS, TIMING_LABELS, CONTACT_LABELS } from "@/lib/shared/serviceRequestLabels";

export const metadata: Metadata = { title: "Requerimientos | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminRequerimientosPage() {
  if (!(await isAdmin())) return null;
  const client = createSupabaseServiceClient();
  const { data: requests, error } = await client
    .from("service_request")
    .select("id, user_profile_id, service_type, description, desired_timing, contact_method, status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`No se pudieron cargar los requerimientos: ${error.message}`);

  const profileIds = [...new Set((requests ?? []).map((request) => request.user_profile_id as string))];
  const { data: profiles } = profileIds.length
    ? await client.from("user_profile").select("id, full_name, email, company_name, mobile_phone").in("id", profileIds)
    : { data: [] };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950">Requerimientos</h1>
        <p className="mt-2 text-neutral-600">Solicitudes de estudios, análisis y servicios enviadas desde la plataforma.</p>
      </header>

      {(requests ?? []).length === 0 ? (
        <Panel>
          <h2 className="text-lg font-semibold text-neutral-950">No hay solicitudes pendientes</h2>
          <p className="mt-2 text-sm text-neutral-600">Los nuevos requerimientos aparecerán aquí.</p>
        </Panel>
      ) : (
        <div className="space-y-4">
          {(requests ?? []).map((request) => {
            const profile = profilesById.get(request.user_profile_id);
            return (
              <Panel key={request.id} className="border-neutral-200">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-950">
                      {SERVICE_LABELS[request.service_type] ?? request.service_type}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      {profile?.full_name ?? profile?.email ?? "Usuario"}{profile?.company_name ? ` · ${profile.company_name}` : ""}
                    </p>
                  </div>
                  <time className="text-sm text-neutral-500" dateTime={request.created_at}>
                    {new Date(request.created_at).toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </div>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{request.description}</p>
                <dl className="mt-5 grid gap-3 border-t border-neutral-100 pt-4 text-sm sm:grid-cols-3">
                  <div><dt className="text-neutral-500">Plazo</dt><dd className="mt-1 font-medium text-neutral-900">{TIMING_LABELS[request.desired_timing]}</dd></div>
                  <div><dt className="text-neutral-500">Contacto</dt><dd className="mt-1 font-medium text-neutral-900">{CONTACT_LABELS[request.contact_method]}</dd></div>
                  <div><dt className="text-neutral-500">Datos</dt><dd className="mt-1 font-medium text-neutral-900">{profile?.mobile_phone ?? profile?.email ?? "Sin información"}</dd></div>
                </dl>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
