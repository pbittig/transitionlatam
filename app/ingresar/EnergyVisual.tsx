import { BellRing, Building2, ChartNoAxesCombined, FolderKanban, Network } from "lucide-react";

export function EnergyVisual() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#08261d]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fondo.png"
        alt="Proyectos de energía renovable en Latinoamérica"
        className="absolute inset-x-0 top-0 h-[125%] w-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#062e29]/95 via-[#0a4941]/80 to-[#0a4941]/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 text-white lg:p-12">
        <div>
          <h2 className="mt-6 max-w-xl text-3xl font-semibold leading-tight tracking-tight lg:text-5xl">
            De los datos a la inteligencia de proyectos.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/80 lg:text-base">
            Transition LATAM integra información clave sobre el ecosistema energético chileno para convertir datos
            dispersos en inteligencia accionable: descubrir oportunidades, priorizar cuentas, seguir el avance
            ambiental y de conexión de cada proyecto, y anticipar sus próximos hitos.
          </p>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            {[
              { icon: ChartNoAxesCombined, title: "Entiende la matriz", text: "Capacidad instalada, construcción y pipeline en una misma lectura." },
              { icon: FolderKanban, title: "Detecte proyectos", text: "Encuentre iniciativas futuras por tecnología, etapa, región y fecha." },
              { icon: Network, title: "Conoce quién está detrás", text: "Relaciona proyecto, empresa titular, grupo y contactos relevantes." },
              { icon: BellRing, title: "Actúe en el momento correcto", text: "Siga cambios clave y transforme señales en oportunidades comerciales." },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
                <Icon size={17} className="text-brand-primary" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-white/65">{text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/65">
          <span className="inline-flex items-center gap-1.5"><Building2 size={13} /> IPP y desarrolladores</span>
          <span>EPC y proveedores</span>
          <span>Inversionistas y asesores</span>
        </div>
      </div>
    </div>
  );
}
