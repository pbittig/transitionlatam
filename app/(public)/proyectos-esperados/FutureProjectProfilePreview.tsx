import { BriefcaseBusiness, Eye, Mail, MapPin, Network, Share2, Zap } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

function PreviewField({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-neutral-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-white">{value}</dd></div>;
}

function Progress({ label, status, value }: { label: string; status: string; value: number }) {
  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-neutral-900 dark:text-white">{label}</p><p className="mt-1 text-xs leading-5 text-neutral-500">{status}</p></div><span className="rounded-md bg-brand-surface px-2 py-1 text-xs font-semibold text-brand-deep">{value}%</span></div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-brand-primary/15"><div className="h-full rounded-full bg-gradient-to-r from-[#333333] to-brand-primary" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export function FutureProjectProfilePreview({ locale }: { locale: AppLocale }) {
  const en = locale === "en";
  return (
    <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <header className="border-b border-neutral-100 p-5 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold text-brand-deep">{en ? "FICTIONAL EXAMPLE PROFILE" : "FICHA DE EJEMPLO FICTICIA"}</p><h3 className="mt-2 text-2xl font-semibold text-neutral-950 dark:text-white">Proyecto Híbrido Valle Norte</h3><p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500"><MapPin size={14} />{en ? "María Elena, Antofagasta Region" : "María Elena, Región de Antofagasta"}</p></div>
          <div className="flex items-center gap-2" aria-label={en ? "Profile actions example" : "Ejemplo de acciones de la ficha"}>
            {[{ icon: Eye, label: en ? "Follow" : "Seguir" }, { icon: BriefcaseBusiness, label: "CRM" }, { icon: Share2, label: en ? "Share" : "Compartir" }].map(({ icon: Icon, label }) => <span key={label} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-deep/20 bg-brand-primary px-3 text-xs font-semibold text-brand-ink"><Icon size={15} />{label}</span>)}
          </div>
        </div>
      </header>

      <div className="space-y-6 p-5">
        <section><h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{en ? "Description" : "Descripción"}</h4><p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{en ? "Proyecto Híbrido Valle Norte is a fictional hybrid project in the Antofagasta Region combining 220 MW of solar generation with a 100 MW / 400 MWh BESS system, connected at the Valle Norte substation." : "Proyecto Híbrido Valle Norte es un proyecto híbrido ficticio ubicado en la Región de Antofagasta, que considera 220 MW de generación solar y un sistema BESS de 100 MW / 400 MWh, con conexión en la subestación Valle Norte."}</p></section>

        <section className="border-y border-neutral-100 py-5 dark:border-neutral-800"><h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{en ? "Technical information" : "Información técnica"}</h4><dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-3 lg:grid-cols-4"><PreviewField label={en ? "Technology" : "Tecnología"} value={en ? "Hybrid · Solar + BESS" : "Híbrido · Solar + BESS"} /><PreviewField label={en ? "Installed power" : "Potencia instalada"} value="220 MW" /><PreviewField label="BESS" value="100 MW / 400 MWh" /><PreviewField label={en ? "BESS duration" : "Duración BESS"} value="4 h" /><PreviewField label={en ? "Developer" : "Desarrollador"} value="Energía Horizonte" /><PreviewField label={en ? "Connection point" : "Punto de conexión"} value="S/E Valle Norte 220 kV" /><PreviewField label={en ? "Declared connection date" : "Fecha de conexión declarada"} value={en ? "October 2029" : "Octubre 2029"} /><PreviewField label={en ? "Project type" : "Tipo de proyecto"} value={en ? "Utility scale" : "Gran escala"} /></dl></section>

        <section><h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{en ? "Project status" : "Estado del proyecto"}</h4><div className="mt-3 grid gap-3 sm:grid-cols-2"><Progress label={en ? "Connection status" : "Estado de conexión"} status={en ? "Final connection authorization report" : "Informe de autorización de conexión final"} value={70} /><Progress label={en ? "Environmental status" : "Estado ambiental"} status={en ? "Under environmental assessment" : "En calificación ambiental"} value={55} /></div></section>

        <section><h4 className="text-sm font-semibold text-neutral-950 dark:text-white">{en ? "Estimated project stages" : "Etapas estimadas del proyecto"}</h4><div className="mt-4 grid grid-cols-4 gap-2"><div className="rounded-md bg-brand-primary p-2 text-center text-[11px] font-semibold text-brand-ink">{en ? "Engineering" : "Ingeniería"}</div><div className="rounded-md bg-brand-primary p-2 text-center text-[11px] font-semibold text-brand-ink">{en ? "Procurement" : "Compras"}</div><div className="rounded-md bg-brand-primary/35 p-2 text-center text-[11px] font-semibold text-neutral-700">{en ? "Construction" : "Construcción"}</div><div className="rounded-md bg-neutral-100 p-2 text-center text-[11px] font-semibold text-neutral-500 dark:bg-neutral-900">{en ? "Connection" : "Conexión"}</div></div></section>

        <div className="grid gap-5 border-t border-neutral-100 pt-5 dark:border-neutral-800 lg:grid-cols-2">
          <section><h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white"><Mail size={15} className="text-brand-primary" />{en ? "Project contacts" : "Contactos del proyecto"}</h4><div className="mt-3 space-y-2 text-sm"><div><p className="font-medium text-neutral-900 dark:text-white">Andrea Rojas</p><p className="text-xs text-neutral-500">{en ? "Development Director" : "Directora de Desarrollo"} · arojas@energiahorizonte.example</p></div><div><p className="font-medium text-neutral-900 dark:text-white">Felipe Torres</p><p className="text-xs text-neutral-500">{en ? "Engineering Manager" : "Gerente de Ingeniería"} · ftorres@energiahorizonte.example</p></div></div></section>
          <section><h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white"><Network size={15} className="text-brand-primary" />{en ? "Related projects" : "Proyectos relacionados"}</h4><div className="mt-3 space-y-2 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-neutral-900 dark:text-white">BESS Pampa Norte</span><span className="text-xs text-neutral-500">80 MW / 320 MWh</span></div><div className="flex items-center justify-between gap-3"><span className="font-medium text-neutral-900 dark:text-white">PFV Desierto Sur</span><span className="text-xs text-neutral-500">150 MW</span></div></div></section>
        </div>

        <p className="flex items-start gap-2 border-t border-neutral-100 pt-4 text-[11px] leading-5 text-neutral-400 dark:border-neutral-800"><Zap size={13} className="mt-0.5 shrink-0" />{en ? "All names, companies, contacts and figures in this preview are fictional." : "Todos los nombres, empresas, contactos y cifras de esta vista previa son ficticios."}</p>
      </div>
    </article>
  );
}
