import { BellRing, Building2, ChartNoAxesCombined, FolderKanban, Network } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function EnergyVisual({ locale = "es" }: { locale?: AppLocale }) {
  const content = locale === "en"
    ? {
        alt: "Renewable energy projects in Latin America",
        title: "From data to project knowledge.",
        description: "Transition LATAM integrates key information about Chile's energy ecosystem to turn scattered data into actionable intelligence: discover opportunities, prioritize accounts, track each project's environmental and grid connection progress, and anticipate upcoming milestones.",
        features: [
          { icon: ChartNoAxesCombined, title: "Understand today's power matrix", text: "Review installed capacity, projects under construction and the current technology mix." },
          { icon: FolderKanban, title: "Discover future projects", text: "Explore initiatives by technology, stage, region and date." },
          { icon: Network, title: "Identify owners", text: "Connect projects with business groups and relevant contacts." },
          { icon: BellRing, title: "Track projects in real time", text: "Monitor their progress and key changes." },
        ],
        audiences: ["IPPs and developers", "EPCs and suppliers", "Investors and advisors"],
      }
    : {
        alt: "Proyectos de energía renovable en Latinoamérica",
        title: "De datos al conocimiento de los proyectos.",
        description: "Transition LATAM integra información clave sobre el ecosistema energético chileno para convertir datos dispersos en inteligencia accionable: descubrir oportunidades, priorizar cuentas, seguir el avance ambiental y de conexión de cada proyecto, y anticipar sus próximos hitos.",
        features: [
          { icon: ChartNoAxesCombined, title: "Entienda la matriz actual", text: "Revise la capacidad instalada, los proyectos en construcción y la composición tecnológica actual." },
          { icon: FolderKanban, title: "Conozca los proyectos futuros", text: "Explore iniciativas por tecnología, etapa, región y fecha." },
          { icon: Network, title: "Identifique a los propietarios", text: "Conecte proyectos con grupos empresariales y contactos relevantes." },
          { icon: BellRing, title: "Siga los proyectos en tiempo real", text: "Monitoree su avance y sus cambios clave." },
        ],
        audiences: ["IPP y desarrolladores", "EPC y proveedores", "Inversionistas y asesores"],
      };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08261d]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fondo.png"
        alt={content.alt}
        className="absolute inset-x-0 top-0 h-[125%] w-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#062e29]/95 via-[#0a4941]/80 to-[#0a4941]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white lg:p-12">
        <div>
          <h2 className="mt-6 max-w-xl text-3xl font-semibold leading-tight tracking-tight lg:text-5xl">
            {content.title}
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/80 lg:text-base">
            {content.description}
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            {content.features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
                <Icon size={17} className="text-brand-primary" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/65">{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/65">
          <span className="inline-flex items-center gap-1.5"><Building2 size={13} /> {content.audiences[0]}</span>
          <span>{content.audiences[1]}</span>
          <span>{content.audiences[2]}</span>
        </div>
      </div>
    </div>
  );
}
