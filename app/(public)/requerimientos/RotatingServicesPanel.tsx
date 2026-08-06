"use client";

import { useEffect, useState } from "react";
import { BarChart3, ChartNoAxesCombined, SearchCheck } from "lucide-react";
import type { AppLocale } from "@/lib/i18n";

export function RotatingServicesPanel({ locale }: { locale: AppLocale }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const services = locale === "en" ? [
    { icon: ChartNoAxesCombined, title: "Market studies", description: "Size demand by technology, region and customer segment, identify growth drivers and compare the competitive landscape.", output: "Market sizing, forecasts, demand drivers, competitor map and executive conclusions." },
    { icon: BarChart3, title: "Market intelligence", description: "Monitor regulatory, investment, project and competitor signals that may change a commercial or investment decision.", output: "Periodic intelligence report, relevant changes, implications, risks and recommended actions." },
    { icon: SearchCheck, title: "Project intelligence", description: "Review project pipelines, developers, milestones, schedules, stakeholders and procurement windows to identify actionable opportunities.", output: "Prioritized project list, opportunity scoring, key contacts, milestones and next steps." },
    { icon: SearchCheck, title: "Project due diligence", description: "Assess a project's technical, permitting, connection, environmental, schedule and counterparty position before an investment or commercial decision.", output: "Risk matrix, evidence review, critical gaps, schedule assessment and red-flag report." },
    { icon: ChartNoAxesCombined, title: "Portfolio screening", description: "Compare a portfolio of projects using consistent criteria for maturity, risk, capacity, timing and strategic fit.", output: "Comparable scorecard, ranked portfolio, risk-return view and shortlist for deeper review." },
    { icon: BarChart3, title: "Market-entry strategy", description: "Define where and how to compete by selecting priority segments, customers, partners and a practical route to market.", output: "Priority segments, value proposition, target accounts, entry roadmap and commercial action plan." },
  ] : [
    { icon: ChartNoAxesCombined, title: "Estudios de mercado", description: "Dimensionamos la demanda por tecnología, región y segmento de cliente, identificamos impulsores de crecimiento y comparamos el entorno competitivo.", output: "Tamaño y proyección de mercado, impulsores de demanda, mapa competitivo y conclusiones ejecutivas." },
    { icon: BarChart3, title: "Inteligencia de mercado", description: "Monitoreamos señales regulatorias, de inversión, proyectos y competidores que pueden modificar una decisión comercial o de inversión.", output: "Reporte periódico, cambios relevantes, implicancias, riesgos y acciones recomendadas." },
    { icon: SearchCheck, title: "Inteligencia de proyectos", description: "Revisamos carteras, desarrolladores, hitos, cronogramas, actores y ventanas de compra para identificar oportunidades accionables.", output: "Lista priorizada, puntuación de oportunidades, contactos clave, hitos y próximos pasos." },
    { icon: SearchCheck, title: "Due diligence de proyectos", description: "Evaluamos la situación técnica, permisos, conexión, medioambiente, cronograma y contrapartes antes de una decisión de inversión o comercial.", output: "Matriz de riesgos, revisión de evidencia, brechas críticas, evaluación del cronograma y reporte de alertas." },
    { icon: ChartNoAxesCombined, title: "Evaluación de carteras", description: "Comparamos una cartera de proyectos con criterios consistentes de madurez, riesgo, capacidad, plazos y ajuste estratégico.", output: "Matriz comparable, ranking de proyectos, visión riesgo-retorno y selección para análisis profundo." },
    { icon: BarChart3, title: "Estrategia de entrada al mercado", description: "Definimos dónde y cómo competir, seleccionando segmentos, clientes, socios y una ruta práctica de entrada.", output: "Segmentos prioritarios, propuesta de valor, cuentas objetivo, hoja de ruta y plan de acción comercial." },
  ];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((current) => (current + 1) % services.length);
        setVisible(true);
      }, 450);
    }, 5600);
    return () => window.clearInterval(interval);
  }, [services.length]);

  const service = services[index];
  const Icon = service.icon;

  return (
    <aside className="relative min-h-[28rem] overflow-hidden rounded-3xl bg-gradient-to-br from-black via-[#272727] to-[#333333] p-7 text-white shadow-xl shadow-black/10 lg:sticky lg:top-8 lg:aspect-square lg:min-h-0">
      <span className="absolute -top-16 -right-16 h-52 w-52 rounded-full border border-white/10" aria-hidden />
      <span className="absolute -right-12 -bottom-16 h-56 w-56 rounded-full bg-brand-primary/20 blur-3xl" aria-hidden />
      <div className={`relative flex h-full flex-col justify-between transition-all duration-500 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`} aria-live="polite">
        <div className="flex items-center justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary text-[#333333]"><Icon size={21} /></span>
          <span className="text-xs font-medium text-white/50">{String(index + 1).padStart(2, "0")} / {String(services.length).padStart(2, "0")}</span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{locale === "en" ? "Specialized analysis" : "Análisis especializado"}</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{service.title}</h2>
          <p className="mt-4 text-sm leading-6 text-white/70">{service.description}</p>
          <div className="mt-6 border-t border-white/15 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{locale === "en" ? "Typical output" : "Entregable habitual"}</p>
            <p className="mt-2 text-xs leading-5 text-white/75">{service.output}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
