"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Expand, Maximize2, Minus, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { OTHER_COLOR, PRINCIPAL_COLOR, TECH_COLORS } from "@/lib/shared/chartColors";
import type { MarketTechCategory } from "@/lib/shared/marketTechCategories";
import type { ObsxGraph, ObsxLink, ObsxLinkKind, ObsxNode, ObsxNodeKind } from "@/lib/data-access/obsxGraph";

const WIDTH = 1120;
const HEIGHT = 660;
/** Bajo este zoom solo se rotulan el centro, lo seleccionado y lo grande: más texto se vuelve ruido. */
const ZOOM_ETIQUETAS = 1.25;

/**
 * El lienzo es oscuro siempre, así que los colores se toman de la variante
 * `dark` de la paleta de marca en vez de `light-dark()`: dentro de una página
 * clara esa función resolvería a los tonos claros, que sobre negro no se leen.
 *
 * El color dice TECNOLOGÍA —la misma que en el resto del sitio, para que un
 * nodo solar sea amarillo aquí y en los gráficos— y la forma dice EN QUÉ
 * UNIVERSO está: círculo lleno para lo que ya opera, anillo punteado para lo
 * que se construye, círculo hueco para lo que todavía es pipeline, y cuadrado
 * para las entidades (empresas, sociedades, personas), que no son activos.
 */
function colorNodo(node: ObsxNode): string {
  if (node.categoria) return TECH_COLORS[node.categoria]?.dark ?? OTHER_COLOR.dark;
  switch (node.kind) {
    case "empresa":
      return PRINCIPAL_COLOR.dark;
    case "empresa_relacionada":
      return "#7f9aa0";
    case "sociedad":
      return "#b9c9cc";
    default:
      return "#e2ecee";
  }
}

function radioNodo(node: ObsxNode): number {
  if (node.kind === "empresa") return 26;
  const base = node.kind === "empresa_relacionada" || node.kind === "sociedad" || node.kind === "persona" ? 8 : 7;
  if (node.mw === null || node.mw <= 0) return base;
  return Math.min(24, base + Math.sqrt(node.mw) * 0.85);
}

const ETIQUETA_TIPO: Record<ObsxNodeKind, string> = {
  empresa: "Empresa",
  empresa_relacionada: "Empresa relacionada",
  sociedad: "Sociedad",
  persona: "Persona",
  proyecto: "Proyecto futuro",
  activo: "Central en operación",
  construccion: "Obra en construcción",
};

const ETIQUETA_RELACION: Record<ObsxLinkKind, string> = {
  desarrolla: "Desarrolla",
  opera: "Opera",
  construye: "Construye",
  relacionada: "Mismo grupo del Coordinador",
  razon_social: "Razón social vinculada",
  controla: "Controla",
  vehiculo: "Sociedad vehículo del proyecto",
};

/**
 * Tres familias visuales = tres niveles de certeza. La propiedad accionaria
 * verificada se dibuja distinta del vínculo operativo, y ambos distintos de la
 * agrupación declarativa, que no afirma propiedad de nadie.
 */
type Familia = "propiedad" | "operativo" | "declarativo";
const FAMILIA: Record<ObsxLinkKind, Familia> = {
  controla: "propiedad",
  vehiculo: "propiedad",
  desarrolla: "operativo",
  opera: "operativo",
  construye: "operativo",
  relacionada: "declarativo",
  razon_social: "declarativo",
};
const ESTILO_FAMILIA: Record<Familia, { stroke: string; width: number; dash?: string }> = {
  propiedad: { stroke: PRINCIPAL_COLOR.dark, width: 1.8 },
  operativo: { stroke: "#4f6f76", width: 1.2 },
  declarativo: { stroke: "#3d5257", width: 1, dash: "3 5" },
};

/** Grupos del filtro rápido: lo que el usuario quiere prender y apagar, no cada `kind`. */
const GRUPOS: Array<{ key: string; label: string; kinds: ObsxNodeKind[] }> = [
  { key: "proyecto", label: "Proyectos futuros", kinds: ["proyecto"] },
  { key: "activo", label: "Operación actual", kinds: ["activo"] },
  { key: "construccion", label: "En construcción", kinds: ["construccion"] },
  { key: "sociedades", label: "Sociedades y personas", kinds: ["sociedad", "persona"] },
  { key: "relacionadas", label: "Empresas relacionadas", kinds: ["empresa_relacionada"] },
];

type SimNode = SimulationNodeDatum & ObsxNode;
type SimLink = SimulationLinkDatum<SimNode> & { kind: ObsxLinkKind; label: string | null };

function compactMw(valor: number): string {
  if (valor >= 1000) return `${(valor / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} GW`;
  return `${Math.round(valor).toLocaleString("es-CL")} MW`;
}

export function ObsxCanvas({ graph }: { graph: ObsxGraph }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulacionRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const arrastradoRef = useRef<SimNode | null>(null);
  const paneoRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const [posiciones, setPosiciones] = useState<SimNode[]>([]);
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 });
  const [seleccion, setSeleccion] = useState<string>(graph.nodes[0]?.id ?? "");
  const [busqueda, setBusqueda] = useState("");
  const [apagados, setApagados] = useState<string[]>([]);
  const [preguntaAbierta, setPreguntaAbierta] = useState(false);

  const kindsOcultos = useMemo(
    () => new Set(GRUPOS.filter((g) => apagados.includes(g.key)).flatMap((g) => g.kinds)),
    [apagados],
  );

  const nodosVisibles = useMemo(
    () => graph.nodes.filter((n) => !kindsOcultos.has(n.kind)),
    [graph.nodes, kindsOcultos],
  );
  const idsVisibles = useMemo(() => new Set(nodosVisibles.map((n) => n.id)), [nodosVisibles]);
  const aristasVisibles = useMemo(
    () => graph.links.filter((l) => idsVisibles.has(l.source as string) && idsVisibles.has(l.target as string)),
    [graph.links, idsVisibles],
  );

  // La simulación se rearma cuando cambia el conjunto visible; cada nodo conserva
  // su posición previa para que apagar un filtro no reordene todo el lienzo.
  useEffect(() => {
    const previas = new Map(posiciones.map((p) => [p.id, { x: p.x, y: p.y }]));
    const nodos: SimNode[] = nodosVisibles.map((n, i) => {
      const previa = previas.get(n.id);
      const angulo = (2 * Math.PI * i) / Math.max(1, nodosVisibles.length);
      return {
        ...n,
        x: previa?.x ?? WIDTH / 2 + Math.cos(angulo) * 240,
        y: previa?.y ?? HEIGHT / 2 + Math.sin(angulo) * 200,
      };
    });
    const centro = nodos.find((n) => n.kind === "empresa");
    if (centro) {
      centro.fx = WIDTH / 2;
      centro.fy = HEIGHT / 2;
    }
    const aristas: SimLink[] = aristasVisibles.map((l: ObsxLink) => ({ ...l }));

    const simulacion = forceSimulation<SimNode, SimLink>(nodos)
      .force(
        "link",
        forceLink<SimNode, SimLink>(aristas)
          .id((n) => n.id)
          .distance((l) => (FAMILIA[l.kind] === "declarativo" ? 145 : 118))
          .strength(0.55),
      )
      .force("charge", forceManyBody<SimNode>().strength((n) => (n.kind === "empresa" ? -900 : -230)))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collision",
        forceCollide<SimNode>().radius((n) => radioNodo(n) + 13),
      )
      .alphaDecay(0.028)
      .on("tick", () => setPosiciones(nodos.map((n) => ({ ...n }))));

    simulacionRef.current = simulacion;
    return () => {
      simulacion.stop();
    };
    // `posiciones` se lee solo para heredar coordenadas; incluirlo reiniciaría
    // la simulación en cada tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodosVisibles, aristasVisibles]);

  const nodoPorId = useMemo(() => new Map(posiciones.map((n) => [n.id, n])), [posiciones]);
  const seleccionado = graph.nodes.find((n) => n.id === seleccion) ?? graph.nodes[0] ?? null;

  const consulta = busqueda.trim().toLowerCase();
  const coincide = useCallback(
    (n: ObsxNode) => consulta.length === 0 || n.label.toLowerCase().includes(consulta),
    [consulta],
  );
  const resultados = useMemo(
    () => (consulta.length < 2 ? [] : nodosVisibles.filter(coincide).slice(0, 6)),
    [consulta, nodosVisibles, coincide],
  );

  const vecinos = useMemo(() => {
    const set = new Set<string>();
    for (const l of aristasVisibles) {
      if (l.source === seleccion) set.add(l.target as string);
      if (l.target === seleccion) set.add(l.source as string);
    }
    return set;
  }, [aristasVisibles, seleccion]);

  /** Qué tipos de relación tocan el nodo elegido, y cuántas de cada uno. */
  const relacionesDelNodo = useMemo(() => {
    const conteo = new Map<ObsxLinkKind, number>();
    for (const l of aristasVisibles) {
      if (l.source !== seleccion && l.target !== seleccion) continue;
      conteo.set(l.kind, (conteo.get(l.kind) ?? 0) + 1);
    }
    return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
  }, [aristasVisibles, seleccion]);

  const puntoDesdeEvento = (event: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    return { x: (x - vista.x) / vista.k, y: (y - vista.y) / vista.k };
  };

  const iniciarArrastre = (event: React.PointerEvent<SVGGElement>, node: SimNode) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const original = simulacionRef.current?.nodes().find((n) => n.id === node.id) ?? null;
    if (!original) return;
    arrastradoRef.current = original;
    original.fx = node.x;
    original.fy = node.y;
    simulacionRef.current?.alphaTarget(0.2).restart();
  };

  const moverArrastre = (event: React.PointerEvent<SVGGElement>) => {
    if (!arrastradoRef.current) return;
    const punto = puntoDesdeEvento(event);
    if (!punto) return;
    arrastradoRef.current.fx = punto.x;
    arrastradoRef.current.fy = punto.y;
  };

  const terminarArrastre = (event: React.PointerEvent<SVGGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const nodo = arrastradoRef.current;
    if (nodo && nodo.kind !== "empresa") {
      nodo.fx = null;
      nodo.fy = null;
    }
    arrastradoRef.current = null;
    simulacionRef.current?.alphaTarget(0);
  };

  const iniciarPaneo = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    paneoRef.current = { x: event.clientX, y: event.clientY, vx: vista.x, vy: vista.y };
  };

  const moverPaneo = (event: React.PointerEvent<SVGSVGElement>) => {
    const paneo = paneoRef.current;
    if (!paneo) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const escala = WIDTH / rect.width;
    setVista((actual) => ({
      ...actual,
      x: paneo.vx + (event.clientX - paneo.x) * escala,
      y: paneo.vy + (event.clientY - paneo.y) * escala,
    }));
  };

  const terminarPaneo = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    paneoRef.current = null;
  };

  const zoom = (factor: number, centroX = WIDTH / 2, centroY = HEIGHT / 2) => {
    setVista((actual) => {
      const k = Math.min(3.5, Math.max(0.45, actual.k * factor));
      const real = k / actual.k;
      return { k, x: centroX - (centroX - actual.x) * real, y: centroY - (centroY - actual.y) * real };
    });
  };

  // El zoom por rueda va con listener no pasivo: React registra `onWheel` como
  // pasivo y `preventDefault()` no frenaría el scroll de la página.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const alRodar = (event: WheelEvent) => {
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoom(
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    svg.addEventListener("wheel", alRodar, { passive: false });
    return () => svg.removeEventListener("wheel", alRodar);
  }, []);

  const centrarEn = (id: string) => {
    setSeleccion(id);
    setBusqueda("");
    const nodo = nodoPorId.get(id);
    if (!nodo || nodo.x === undefined || nodo.y === undefined) return;
    const k = Math.max(vista.k, 1.4);
    setVista({ k, x: WIDTH / 2 - nodo.x * k, y: HEIGHT / 2 - nodo.y * k });
  };

  const pantallaCompleta = () => {
    const nodo = contenedorRef.current;
    if (!nodo) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void nodo.requestFullscreen?.();
  };

  const tecnologiasEnUso = useMemo(
    () => [...new Set(graph.nodes.map((n) => n.categoria).filter((c): c is MarketTechCategory => c !== null))],
    [graph.nodes],
  );

  return (
    <div
      ref={contenedorRef}
      className="overflow-hidden rounded-2xl border border-[#14383c] bg-[#03181a] shadow-xl shadow-teal-950/20"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-sm text-white sm:max-w-sm">
          <Search size={15} className="shrink-0 text-white/45" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar en el grafo..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-white/35"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
              <X size={14} className="text-white/45" />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          {GRUPOS.map((grupo) => {
            const activo = !apagados.includes(grupo.key);
            const total = graph.nodes.filter((n) => grupo.kinds.includes(n.kind)).length;
            if (total === 0) return null;
            return (
              <button
                key={grupo.key}
                type="button"
                aria-pressed={activo}
                onClick={() =>
                  setApagados((actual) =>
                    actual.includes(grupo.key) ? actual.filter((k) => k !== grupo.key) : [...actual, grupo.key],
                  )
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  activo
                    ? "border-brand-primary/45 bg-brand-primary/15 text-[#7fe6da]"
                    : "border-white/12 text-white/40 hover:text-white/70"
                }`}
              >
                {grupo.label} · {total}
              </button>
            );
          })}
        </div>

        {graph.esEjemplo && (
          <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-amber-300 uppercase">
            Ejemplo ficticio
          </span>
        )}

        <button
          type="button"
          onClick={() => setPreguntaAbierta((abierto) => !abierto)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-medium text-white/80 hover:bg-white/5"
        >
          <Sparkles size={14} className="text-[#65e2d3]" /> Preguntar a ObsX
        </button>
      </div>

      {resultados.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-white/10 bg-white/[0.02] px-4 py-2">
          {resultados.map((nodo) => (
            <button
              key={nodo.id}
              type="button"
              onClick={() => centrarEn(nodo.id)}
              className="rounded-md border border-white/12 px-2 py-1 text-[11px] text-white/80 hover:border-brand-primary/50 hover:text-white"
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: colorNodo(nodo) }} />
              {nodo.label}
            </button>
          ))}
        </div>
      )}

      {preguntaAbierta && (
        <div className="border-b border-white/10 bg-[#062024] px-4 py-3 text-xs text-white/70">
          <p className="font-semibold text-white">Preguntas que ObsX podrá responder</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>· ¿Qué sociedades están detrás de este proyecto?</li>
            <li>· ¿Qué empresas desarrollan más de lo que operan?</li>
            <li>· ¿Qué proyectos BESS de más de 100 MW no están en mi CRM?</li>
            <li>· ¿Qué obras entran en construcción este año?</li>
          </ul>
          <p className="mt-2 text-white/45">
            La respuesta en lenguaje natural todavía no está habilitada. Hoy las mismas preguntas se responden con los
            filtros del lienzo y con Análisis dinámico.
          </p>
        </div>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="block h-full max-h-[78vh] min-h-[520px] w-full touch-none cursor-grab bg-[#03181a] active:cursor-grabbing"
            style={{
              backgroundImage: "radial-gradient(rgba(91,209,198,.10) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
            onPointerDown={iniciarPaneo}
            onPointerMove={moverPaneo}
            onPointerUp={terminarPaneo}
            onPointerCancel={terminarPaneo}
            role="img"
            aria-label={`Grafo de relaciones de ${graph.company.name}`}
          >
            <defs>
              <marker id="obsx-flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={PRINCIPAL_COLOR.dark} />
              </marker>
            </defs>

            <g transform={`translate(${vista.x} ${vista.y}) scale(${vista.k})`}>
              {aristasVisibles.map((arista, indice) => {
                const desde = nodoPorId.get(arista.source as string);
                const hasta = nodoPorId.get(arista.target as string);
                if (!desde || !hasta) return null;
                const estilo = ESTILO_FAMILIA[FAMILIA[arista.kind]];
                const tocaSeleccion = arista.source === seleccion || arista.target === seleccion;
                return (
                  <g key={`${arista.source}-${arista.target}-${indice}`}>
                    <line
                      x1={desde.x}
                      y1={desde.y}
                      x2={hasta.x}
                      y2={hasta.y}
                      stroke={estilo.stroke}
                      strokeWidth={estilo.width * (tocaSeleccion ? 1.9 : 1)}
                      strokeDasharray={estilo.dash}
                      opacity={tocaSeleccion ? 0.95 : 0.42}
                      markerEnd={FAMILIA[arista.kind] === "propiedad" ? "url(#obsx-flecha)" : undefined}
                    />
                    {arista.label && vista.k >= ZOOM_ETIQUETAS && (
                      <text
                        x={((desde.x ?? 0) + (hasta.x ?? 0)) / 2}
                        y={((desde.y ?? 0) + (hasta.y ?? 0)) / 2 - 5}
                        textAnchor="middle"
                        fill="#7fe6da"
                        fontSize="9"
                        fontWeight="600"
                      >
                        {arista.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {posiciones.map((nodo) => {
                const color = colorNodo(nodo);
                const radio = radioNodo(nodo);
                const esCentro = nodo.kind === "empresa";
                const esEntidad = esCentro || nodo.kind === "empresa_relacionada" || nodo.kind === "sociedad" || nodo.kind === "persona";
                const activo = seleccion === nodo.id;
                const atenuado = consulta.length > 1 && !coincide(nodo);
                const rotulado =
                  !atenuado && (esCentro || activo || vecinos.has(nodo.id) || vista.k >= ZOOM_ETIQUETAS || (nodo.mw ?? 0) >= 150);
                return (
                  <g
                    key={nodo.id}
                    transform={`translate(${nodo.x ?? 0} ${nodo.y ?? 0})`}
                    opacity={atenuado ? 0.16 : 1}
                    className="cursor-pointer"
                    onPointerDown={(event) => iniciarArrastre(event, nodo)}
                    onPointerMove={moverArrastre}
                    onPointerUp={terminarArrastre}
                    onPointerCancel={terminarArrastre}
                    onClick={() => setSeleccion(nodo.id)}
                  >
                    {activo && <circle r={radio + 7} fill="none" stroke={color} strokeWidth="1.4" opacity=".55" />}
                    {esEntidad ? (
                      <rect
                        x={-radio}
                        y={-radio}
                        width={radio * 2}
                        height={radio * 2}
                        rx={esCentro ? 9 : 4}
                        fill={esCentro ? color : "#03181a"}
                        stroke={color}
                        strokeWidth={esCentro ? 0 : 1.8}
                      />
                    ) : (
                      <circle
                        r={radio}
                        fill={nodo.kind === "activo" ? color : "#03181a"}
                        stroke={color}
                        strokeWidth={nodo.kind === "construccion" ? 2.2 : 1.8}
                        strokeDasharray={nodo.kind === "construccion" ? "3 2.5" : undefined}
                      />
                    )}
                    {rotulado && (
                      <text
                        x={0}
                        y={radio + 12}
                        textAnchor="middle"
                        fill={esCentro || activo ? "#ffffff" : "rgba(255,255,255,.72)"}
                        fontSize={esCentro ? 12 : 9.5}
                        fontWeight={esCentro || activo ? 700 : 500}
                        style={{ paintOrder: "stroke", stroke: "#03181a", strokeWidth: 3 }}
                      >
                        {nodo.label.length > 34 ? `${nodo.label.slice(0, 33)}…` : nodo.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-[10px] text-white/55">
            <span className="font-semibold text-white/85">Relación:</span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-5" style={{ background: PRINCIPAL_COLOR.dark }} /> Propiedad verificada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-5 bg-[#4f6f76]" /> Vínculo operativo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-px w-5 border-t border-dashed border-[#3d5257]" /> Agrupación declarada
            </span>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 px-4 py-3">
            <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/55">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/70" /> En operación
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-white/70" /> En construcción
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-white/70" /> Proyecto futuro
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-white/70" /> Sociedad o empresa
              </span>
              {tecnologiasEnUso.map((tecnologia) => (
                <span key={tecnologia} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: TECH_COLORS[tecnologia]?.dark ?? OTHER_COLOR.dark }}
                  />
                  {tecnologia}
                </span>
              ))}
            </div>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <BotonLienzo onClick={() => zoom(1.2)} etiqueta="Acercar">
                <Plus size={15} />
              </BotonLienzo>
              <BotonLienzo onClick={() => zoom(1 / 1.2)} etiqueta="Alejar">
                <Minus size={15} />
              </BotonLienzo>
              <BotonLienzo onClick={() => setVista({ x: 0, y: 0, k: 1 })} etiqueta="Restablecer vista">
                <RotateCcw size={14} />
              </BotonLienzo>
              <BotonLienzo onClick={() => centrarEn(graph.nodes[0]?.id ?? "")} etiqueta="Centrar en la empresa">
                <Expand size={15} />
              </BotonLienzo>
              <BotonLienzo onClick={pantallaCompleta} etiqueta="Pantalla completa">
                <Maximize2 size={15} />
              </BotonLienzo>
            </div>
          </div>
        </div>

        <aside className="border-t border-white/10 bg-[#061e21] text-white xl:border-t-0 xl:border-l">
          {seleccionado ? (
            <div className="flex h-full flex-col gap-4 p-4">
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold"
                  style={{
                    background: `color-mix(in srgb, ${colorNodo(seleccionado)} 18%, transparent)`,
                    color: colorNodo(seleccionado),
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorNodo(seleccionado) }} />
                  {ETIQUETA_TIPO[seleccionado.kind]}
                  {seleccionado.categoria ? ` · ${seleccionado.categoria}` : ""}
                </span>
                <h3 className="mt-2 text-base leading-snug font-semibold">{seleccionado.label}</h3>
                {seleccionado.detail && <p className="mt-1 text-xs text-white/60">{seleccionado.detail}</p>}
              </div>

              <dl className="grid gap-2 text-xs">
                {seleccionado.mw !== null && <Dato termino="Potencia" valor={`${seleccionado.mw.toLocaleString("es-CL")} MW`} />}
                {seleccionado.mwh !== null && (
                  <Dato termino="Almacenamiento" valor={`${seleccionado.mwh.toLocaleString("es-CL")} MWh`} />
                )}
                {seleccionado.region && <Dato termino="Región" valor={seleccionado.region} />}
                <Dato termino="Conexiones" valor={String(vecinos.size || contarConexiones(graph.links, seleccionado.id))} />
              </dl>

              {seleccionado.kind === "empresa" && (
                <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
                  <p className="text-[10px] font-semibold tracking-wider text-white/45 uppercase">Presente y futuro</p>
                  <Dato termino="En operación" valor={compactMw(graph.resumen.operacionMw)} />
                  <Dato termino="En construcción" valor={compactMw(graph.resumen.construccionMw)} />
                  <Dato termino="En cartera" valor={compactMw(graph.resumen.pipelineMw)} />
                </div>
              )}

              {relacionesDelNodo.length > 0 && (
                <div className="grid gap-1.5 text-xs">
                  <p className="text-[10px] font-semibold tracking-wider text-white/45 uppercase">Relaciones</p>
                  {relacionesDelNodo.map(([kind, total]) => (
                    <Dato key={kind} termino={ETIQUETA_RELACION[kind]} valor={String(total)} />
                  ))}
                </div>
              )}

              <p className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-5 text-white/55">
                <span className="font-semibold text-white/75">Fuente:</span> {seleccionado.fuente}
              </p>

              <div className="mt-auto grid gap-2">
                {seleccionado.href && (
                  <Link
                    href={seleccionado.href}
                    className="rounded-lg bg-brand-primary py-2 text-center text-xs font-semibold text-[#052020] hover:bg-[#63e3d4]"
                  >
                    Ver ficha del proyecto
                  </Link>
                )}
                <Link
                  href="/crm"
                  className="rounded-lg border border-white/15 py-2 text-center text-xs font-medium text-white/85 hover:bg-white/5"
                >
                  Llevar al CRM
                </Link>
              </div>
            </div>
          ) : (
            <p className="p-4 text-xs text-white/60">Seleccione un nodo del lienzo para ver su detalle.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function contarConexiones(links: ObsxLink[], id: string): number {
  return links.filter((l) => l.source === id || l.target === id).length;
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-white/55">{termino}</dt>
      <dd className="text-right font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

function BotonLienzo({ onClick, etiqueta, children }: { onClick: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#03181a]/85 text-white/85 hover:bg-white/10"
    >
      {children}
    </button>
  );
}
