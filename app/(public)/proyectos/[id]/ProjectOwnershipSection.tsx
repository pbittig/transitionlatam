import { Building2, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import type { AppLocale } from "@/lib/i18n";
import type { OwnershipEntity, ProjectOwnershipMap } from "@/lib/data-access/projectOwnership";
import { formatRutForDisplay } from "@/lib/shared/formatRut";

function EntityCard({ entity, spv = false }: { entity: OwnershipEntity; spv?: boolean }) {
  const person = entity.entityType === "person";
  return (
    <div className={`mx-auto w-48 rounded-xl border px-4 py-3 text-center shadow-sm ${
      spv
        ? "border-2 border-brand-primary bg-brand-surface ring-4 ring-brand-primary/10 dark:bg-brand-primary/10"
        : person
          ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
          : "border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
    }`}>
      <div className="mb-1 flex justify-center text-neutral-500 dark:text-neutral-400">
        {person ? <UserRound size={15} /> : <Building2 size={15} />}
      </div>
      <p className="text-xs font-semibold leading-4 text-neutral-900 dark:text-neutral-50">{entity.legalName}</p>
      {entity.rut && <p className="mt-1 text-[11px] tabular-nums text-neutral-500 dark:text-neutral-400">{formatRutForDisplay(entity.rut)}</p>}
      {entity.countryCode && entity.countryCode !== "CL" && (
        <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">{entity.countryCode}</p>
      )}
      {spv && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-deep">SPV / titular</p>}
    </div>
  );
}

function Connector({ percent }: { percent?: number }) {
  return (
    <div className="relative mx-auto h-12 w-px border-l border-dashed border-neutral-300 dark:border-neutral-700">
      {percent !== undefined && (
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-600 shadow-sm dark:bg-neutral-950 dark:text-neutral-300">
          {percent.toLocaleString("es-CL", { maximumFractionDigits: 2 })}%
        </span>
      )}
      <span className="absolute -bottom-0.5 -left-[3px] h-0 w-0 border-x-4 border-t-[6px] border-x-transparent border-t-neutral-400" />
    </div>
  );
}

function OwnershipBranch({ map, entityId, visited = new Set<string>() }: { map: ProjectOwnershipMap; entityId: string; visited?: Set<string> }) {
  const entity = map.entities.find((item) => item.id === entityId);
  if (!entity || visited.has(entityId)) return null;
  const nextVisited = new Set(visited).add(entityId);
  const owners = map.relations.filter((relation) => relation.ownedEntityId === entityId);

  return (
    <div className="flex min-w-52 flex-col items-center">
      {owners.length > 0 && (
        <>
          <div className="flex w-full flex-wrap items-end justify-center gap-x-8 gap-y-4">
            {owners.map((relation) => (
              <div key={`${relation.ownerEntityId}:${entityId}`} className="flex flex-col items-center">
                <OwnershipBranch map={map} entityId={relation.ownerEntityId} visited={nextVisited} />
                <Connector percent={relation.ownershipPercent} />
              </div>
            ))}
          </div>
          {owners.length > 1 && <div className="h-px w-3/4 bg-neutral-300 dark:bg-neutral-700" />}
          {owners.length > 1 && <Connector />}
        </>
      )}
      <EntityCard entity={entity} spv={entityId === map.spvEntityId} />
    </div>
  );
}

function OwnershipPreview({ locale }: { locale: AppLocale }) {
  return (
    <div className="relative min-h-80 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50/70 p-6 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div aria-hidden className="flex select-none flex-col items-center opacity-45 blur-[3px]">
        <div className="h-20 w-44 rounded-xl border border-emerald-300 bg-emerald-50" />
        <Connector percent={100} />
        <div className="h-20 w-44 rounded-xl border border-sky-300 bg-sky-50" />
        <Connector percent={100} />
        <div className="h-20 w-44 rounded-xl border-2 border-brand-primary bg-brand-surface" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/35 backdrop-blur-[2px] dark:bg-neutral-950/35">
        <div className="max-w-sm rounded-2xl border border-white/80 bg-white/90 p-5 text-center shadow-xl dark:border-neutral-700 dark:bg-neutral-900/95">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-surface text-brand-primary"><LockKeyhole size={18} /></span>
          <p className="mt-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{locale === "en" ? "Ownership map available on Prime" : "Mapa de propiedad disponible en Prime"}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{locale === "en" ? "View owners, controllers, percentages and the complete corporate chain." : "Consulta propietarios, controladores, porcentajes y la cadena societaria completa."}</p>
          <Link href="/planes" className="mt-4 inline-flex rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-deep">{locale === "en" ? "View plans" : "Ver planes"}</Link>
        </div>
      </div>
    </div>
  );
}

export function ProjectOwnershipSection({ map, projectName, locked, locale }: { map: ProjectOwnershipMap; projectName: string; locked: boolean; locale: AppLocale }) {
  if (locked) return <OwnershipPreview locale={locale} />;
  const spv = map.entities.find((entity) => entity.id === map.spvEntityId);
  const controllers = map.entities.filter((entity) => !map.relations.some((relation) => relation.ownedEntityId === entity.id));
  return (
    <div className="space-y-5">
      <dl className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-3 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div><dt className="text-[11px] text-neutral-500">SPV / titular</dt><dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{spv?.legalName ?? "—"}</dd></div>
        <div><dt className="text-[11px] text-neutral-500">{locale === "en" ? "Ultimate controller" : "Controlador final"}</dt><dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{controllers.map((item) => item.legalName).join(" · ") || "—"}</dd></div>
        <div><dt className="text-[11px] text-neutral-500">{locale === "en" ? "Coverage" : "Cobertura"}</dt><dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">{map.coverageStatus === "complete" ? (locale === "en" ? "Complete chain" : "Cadena completa") : (locale === "en" ? "Partial information" : "Información parcial")}</dd></div>
      </dl>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white px-6 py-8 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex min-w-max flex-col items-center">
          <OwnershipBranch map={map} entityId={map.spvEntityId} />
          <Connector />
          <div className="w-52 rounded-xl border border-neutral-300 bg-neutral-900 px-4 py-3 text-center text-white shadow-sm dark:bg-white dark:text-neutral-950">
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Proyecto</p>
            <p className="mt-1 text-xs font-semibold leading-4">{projectName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
