import type { Metadata } from "next";
import { isAdmin } from "@/lib/auth/session";
import { createSupabaseServiceClient } from "@/lib/data-access/supabase-service-client";
import { getOrphanRelationships } from "@/lib/data-access/orphanRelationships";
import { formatDateOnly } from "@/lib/shared/formatDateOnly";
import { Panel } from "../../components/Panel";
import { OrphanRow } from "./OrphanRow";
import { CleanupButton } from "./CleanupButton";

export const metadata: Metadata = { title: "Vínculos huérfanos — Admin" };
export const dynamic = "force-dynamic";

const RELACION_LABEL: Record<string, string> = {
  developed_by: "desarrollado por",
  parent_company: "matriz",
  legal_representative: "representante legal de",
  project_coordinator_1: "coordinador 1 de",
  project_coordinator_2: "coordinador 2 de",
};

const ORIGEN_LABEL: Record<string, string> = {
  person: "Persona",
  project: "Proyecto",
  spv: "SPV",
  company: "Empresa",
};

export default async function HuerfanosPage() {
  if (!(await isAdmin())) return null;
  const { items, totales } = await getOrphanRelationships(createSupabaseServiceClient());
  const conEmpresaPerdida = items.filter((i) => i.kind === "company_target");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Vínculos huérfanos</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Relaciones que apuntan a algo que ya no existe. Se acumulan porque la tabla guarda el par (tipo, id) en
          columnas genéricas, sin llave foránea: borrar un proyecto o una empresa no arrastra sus vínculos ni avisa que
          quedaron colgando. No se limpian solas — un vínculo perdido puede ser la única pista de que un borrado se
          llevó más de lo que correspondía.
        </p>
      </div>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Perdieron la empresa · {totales.company_target ?? 0}
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            El origen sigue vivo pero la empresa a la que apuntaba se borró. Acá sí hay algo que decidir: a qué empresa
            corresponde ahora, o si el vínculo ya no aplica.
          </p>
        </div>
        {conEmpresaPerdida.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">No queda ninguno.</p>
        ) : (
          <ul className="flex flex-col">
            {conEmpresaPerdida.map((i) => (
              <OrphanRow
                key={i.id}
                id={i.id}
                permiteReasignar
                descripcion={`${ORIGEN_LABEL[i.origenTipo] ?? i.origenTipo} “${i.origen ?? "sin nombre"}” · ${
                  RELACION_LABEL[i.relationshipType] ?? i.relationshipType
                } · desde ${formatDateOnly(i.createdAt) ?? "—"}`}
              />
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            Su proyecto ya no existe · {(totales.project_gone ?? 0).toLocaleString("es-CL")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Quedaron de proyectos eliminados. No hay a qué reapuntarlos —el proyecto no está— así que no hay decisión
            que tomar: son residuo. Se quitan todos de una vez en vez de uno por uno.
          </p>
        </div>
        <CleanupButton total={totales.project_gone ?? 0} />
      </Panel>
    </div>
  );
}
