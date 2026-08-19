import type { ObsxGraph, ObsxLink, ObsxNode } from "@/lib/data-access/obsxGraph";

/**
 * La forma completa de ObsX, con nombres inventados a propósito.
 *
 * Por qué existe: hoy la base no tiene estructura societaria. `company_shareholding`
 * está vacía y las 12 fichas societarias verificadas cubren un proyecto cada una,
 * así que ningún grafo real llega a mostrar una matriz con filiales, SPV,
 * personas controladoras y activos colgando de la misma cadena. Esta vista
 * enseña a qué va a llegar la pantalla cuando entre la API de sociedades, sin
 * poner nombres reales en relaciones que nadie ha verificado.
 *
 * Misma convención que `OwnershipChainDiagram` en Propietarios: se rotula
 * "Ejemplo ficticio" en cada superficie donde aparece, los RUT son inválidos a
 * propósito y no se mezcla ni un dato real. Cuando la API esté integrada, este
 * archivo se borra.
 */

const EMPRESA = { id: "demo", name: "Grupo Energético Cordillera SpA", rut: "99.999.991-3" };

const FUENTE = "Ejemplo ficticio — no son datos de ninguna empresa real";

type Semilla = Omit<ObsxNode, "fuente">;

const SEMILLAS: Semilla[] = [
  // Matriz y personas controladoras.
  {
    id: "empresa:demo",
    label: EMPRESA.name,
    kind: "empresa",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: `RUT ${EMPRESA.rut} · Matriz`,
    href: null,
  },
  {
    id: "persona:fuentes",
    label: "María Fuentes Aravena",
    kind: "persona",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Controladora",
    href: null,
  },
  {
    id: "persona:ramirez",
    label: "Jorge Ramírez Soto",
    kind: "persona",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Socio",
    href: null,
  },

  // Primer nivel societario.
  {
    id: "sociedad:holding",
    label: "Inversiones Cordillera Holding SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "RUT 99.999.992-1",
    href: null,
  },
  {
    id: "sociedad:futuros",
    label: "Futuros Desarrollos Cordillera SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "RUT 99.999.993-K",
    href: null,
  },
  {
    id: "sociedad:infra",
    label: "Infraestructura Cordillera SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "RUT 99.999.994-8",
    href: null,
  },

  // Segundo nivel: operadora, almacenamiento y las SPV de cada proyecto.
  {
    id: "sociedad:operadora",
    label: "Cordillera Generación SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Opera los activos del grupo",
    href: null,
  },
  {
    id: "sociedad:almacenamiento",
    label: "Almacenamiento Atacama SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "RUT 99.999.995-6",
    href: null,
  },
  {
    id: "sociedad:spv-solar",
    label: "SPV Solar Atacama SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Sociedad vehículo",
    href: null,
  },
  {
    id: "sociedad:spv-eolico",
    label: "SPV Eólico Pampas SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Sociedad vehículo",
    href: null,
  },
  {
    id: "sociedad:spv-hibrido",
    label: "Híbrido Norte SpA",
    kind: "sociedad",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Sociedad vehículo",
    href: null,
  },

  // Activos en operación.
  {
    id: "activo:el-sol",
    label: "Central Solar El Sol",
    kind: "activo",
    categoria: "Solar",
    mw: 220,
    mwh: null,
    region: "Región de Antofagasta",
    detail: "Operativa desde 2021",
    href: null,
  },
  {
    id: "activo:los-vientos",
    label: "Parque Eólico Los Vientos",
    kind: "activo",
    categoria: "Eólico",
    mw: 142,
    mwh: null,
    region: "Región del Biobío",
    detail: "Operativa desde 2019",
    href: null,
  },
  {
    id: "activo:maule",
    label: "Central Hidro Maule Dos",
    kind: "activo",
    categoria: "Hidro",
    mw: 48,
    mwh: null,
    region: "Región del Maule",
    detail: "Operativa desde 2016",
    href: null,
  },
  {
    id: "activo:bahia",
    label: "Central Térmica Bahía",
    kind: "activo",
    categoria: "Térmica",
    mw: 180,
    mwh: null,
    region: "Región de Valparaíso",
    detail: "Operativa · respaldo",
    href: null,
  },

  // Obras en construcción.
  {
    id: "construccion:bess-desierto",
    label: "BESS Desierto",
    kind: "construccion",
    categoria: "BESS",
    mw: 200,
    mwh: 800,
    region: "Región de Antofagasta",
    detail: "Interconexión estimada 2027-03",
    href: null,
  },
  {
    id: "construccion:linea",
    label: "Línea 2x500 kV Nueva Cordillera",
    kind: "construccion",
    categoria: "Transmisión",
    mw: null,
    mwh: null,
    region: "Región de Atacama",
    detail: "Obra de transmisión adjudicada",
    href: null,
  },

  // Pipeline futuro.
  {
    id: "proyecto:solar-atacama",
    label: "Proyecto Solar Atacama",
    kind: "proyecto",
    categoria: "Solar",
    mw: 300,
    mwh: null,
    region: "Región de Atacama",
    detail: "Etapa 8/12",
    href: null,
  },
  {
    id: "proyecto:eolico-pampas",
    label: "Proyecto Eólico Pampas",
    kind: "proyecto",
    categoria: "Eólico",
    mw: 250,
    mwh: null,
    region: "Región de Antofagasta",
    detail: "Etapa 6/12",
    href: null,
  },
  {
    id: "proyecto:hibrido-norte",
    label: "Proyecto Híbrido Norte",
    kind: "proyecto",
    categoria: "Híbrido",
    mw: 400,
    mwh: 600,
    region: "Región de Tarapacá",
    detail: "Etapa 4/12",
    href: null,
  },
  {
    id: "proyecto:bess-pampa",
    label: "BESS Pampa Norte",
    kind: "proyecto",
    categoria: "BESS",
    mw: 120,
    mwh: 480,
    region: "Región de Antofagasta",
    detail: "Etapa 5/12",
    href: null,
  },
  {
    id: "proyecto:solar-elqui",
    label: "PFV Valle del Elqui",
    kind: "proyecto",
    categoria: "Solar",
    mw: 96,
    mwh: null,
    region: "Región de Coquimbo",
    detail: "Etapa 3/12",
    href: null,
  },

  // Empresas del mismo grupo, sin relación de propiedad declarada.
  {
    id: "relacionada:andes",
    label: "Andes Capital Energía SpA",
    kind: "empresa_relacionada",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Mismo grupo declarado",
    href: null,
  },
  {
    id: "relacionada:norte",
    label: "Norte Energía Renovable SpA",
    kind: "empresa_relacionada",
    categoria: null,
    mw: null,
    mwh: null,
    region: null,
    detail: "Mismo grupo declarado",
    href: null,
  },
];

const ARISTAS: ObsxLink[] = [
  // Personas → matriz.
  { source: "persona:fuentes", target: "empresa:demo", kind: "controla", label: "55%" },
  { source: "persona:ramirez", target: "empresa:demo", kind: "controla", label: "45%" },

  // Matriz → primer nivel.
  { source: "empresa:demo", target: "sociedad:holding", kind: "controla", label: "100%" },
  { source: "empresa:demo", target: "sociedad:futuros", kind: "controla", label: "60%" },
  { source: "empresa:demo", target: "sociedad:infra", kind: "controla", label: "100%" },

  // Holding → operación y almacenamiento.
  { source: "sociedad:holding", target: "sociedad:operadora", kind: "controla", label: "100%" },
  { source: "sociedad:holding", target: "sociedad:almacenamiento", kind: "controla", label: "70%" },

  // Futuros desarrollos → SPV por proyecto.
  { source: "sociedad:futuros", target: "sociedad:spv-solar", kind: "controla", label: "100%" },
  { source: "sociedad:futuros", target: "sociedad:spv-eolico", kind: "controla", label: "100%" },
  { source: "sociedad:futuros", target: "sociedad:spv-hibrido", kind: "controla", label: "51%" },

  // SPV → proyecto.
  { source: "sociedad:spv-solar", target: "proyecto:solar-atacama", kind: "vehiculo", label: null },
  { source: "sociedad:spv-eolico", target: "proyecto:eolico-pampas", kind: "vehiculo", label: null },
  { source: "sociedad:spv-hibrido", target: "proyecto:hibrido-norte", kind: "vehiculo", label: null },
  { source: "sociedad:almacenamiento", target: "proyecto:bess-pampa", kind: "vehiculo", label: null },
  { source: "sociedad:almacenamiento", target: "construccion:bess-desierto", kind: "vehiculo", label: null },

  // Quién opera, desarrolla y construye.
  { source: "sociedad:operadora", target: "activo:el-sol", kind: "opera", label: null },
  { source: "sociedad:operadora", target: "activo:los-vientos", kind: "opera", label: null },
  { source: "sociedad:operadora", target: "activo:maule", kind: "opera", label: null },
  { source: "sociedad:operadora", target: "activo:bahia", kind: "opera", label: null },
  { source: "sociedad:infra", target: "construccion:linea", kind: "construye", label: null },
  { source: "empresa:demo", target: "proyecto:solar-elqui", kind: "desarrolla", label: null },
  { source: "sociedad:futuros", target: "proyecto:solar-elqui", kind: "desarrolla", label: null },

  // Agrupación declarada, sin propiedad.
  { source: "empresa:demo", target: "relacionada:andes", kind: "relacionada", label: null },
  { source: "empresa:demo", target: "relacionada:norte", kind: "relacionada", label: null },
];

/** El grafo de ejemplo. Se arma en memoria: no toca la base ni depende de la sesión. */
export function getObsxDemoGraph(): ObsxGraph {
  const nodes: ObsxNode[] = SEMILLAS.map((semilla) => ({ ...semilla, fuente: FUENTE }));

  const sumar = (kind: ObsxNode["kind"], campo: "mw" | "mwh") =>
    nodes.filter((n) => n.kind === kind).reduce((suma, n) => suma + (n[campo] ?? 0), 0);
  const contar = (kind: ObsxNode["kind"]) => nodes.filter((n) => n.kind === kind).length;
  const bess = nodes.filter((n) => n.categoria === "BESS");

  return {
    company: EMPRESA,
    nodes,
    links: ARISTAS,
    esEjemplo: true,
    resumen: {
      pipelineMw: sumar("proyecto", "mw"),
      pipelineCount: contar("proyecto"),
      operacionMw: sumar("activo", "mw"),
      operacionCount: contar("activo"),
      construccionMw: sumar("construccion", "mw"),
      construccionCount: contar("construccion"),
      bessMw: bess.reduce((suma, n) => suma + (n.mw ?? 0), 0),
      bessMwh: bess.reduce((suma, n) => suma + (n.mwh ?? 0), 0),
      bessCount: bess.length,
      proximosMw: 420,
      proximosCount: 2,
      sinTecnologia: 0,
      regiones: [...new Set(nodes.map((n) => n.region).filter((r): r is string => !!r))].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
      tecnologias: [...new Set(nodes.map((n) => n.categoria).filter((c) => c !== null))],
      relacionadas: contar("empresa_relacionada"),
      razonesSociales: contar("sociedad"),
      // Una sola cadena societaria, la del grupo completo.
      cadenasSocietarias: 1,
    },
    omitidos: { proyectos: 0, activos: 0, construccion: 0, razonesSociales: 0, relacionadas: 0 },
  };
}
