"use client";

import { useEffect, useRef, useState } from "react";
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
import type { AppLocale } from "@/lib/i18n";

type NodeKind = "spv" | "shareholder" | "project";
type GraphNode = SimulationNodeDatum & { id: string; label: string; kind: NodeKind };
type GraphLink = SimulationLinkDatum<GraphNode> & { source: string | GraphNode; target: string | GraphNode; label?: string };

const WIDTH = 820;
const HEIGHT = 410;
const COLORS: Record<NodeKind, string> = { spv: "#333333", shareholder: "#38d7c5", project: "#dff8f4" };

const INITIAL_NODES: GraphNode[] = [
  { id: "spv", label: "Horizonte Solar SpA", kind: "spv", x: 410, y: 190 },
  { id: "cordillera", label: "Inversiones Cordillera", kind: "shareholder", x: 230, y: 90 },
  { id: "fondo", label: "Fondo Infraestructura Sur", kind: "shareholder", x: 590, y: 90 },
  { id: "solar", label: "Parque Solar Horizonte", kind: "project", x: 410, y: 315 },
  { id: "bess", label: "BESS Cordillera Central", kind: "project", x: 120, y: 285 },
  { id: "pfv", label: "PFV Desierto Claro", kind: "project", x: 610, y: 300 },
  { id: "hybrid", label: "Híbrido Altiplano", kind: "project", x: 745, y: 245 },
  { id: "partner", label: "Capital Renovable SpA", kind: "shareholder", x: 700, y: 165 },
];

const INITIAL_LINKS: GraphLink[] = [
  { source: "cordillera", target: "spv", label: "70%" },
  { source: "fondo", target: "spv", label: "30%" },
  { source: "spv", target: "solar" },
  { source: "cordillera", target: "bess" },
  { source: "fondo", target: "pfv" },
  { source: "fondo", target: "hybrid" },
  { source: "partner", target: "hybrid", label: "40%" },
];

export function OwnershipNetworkPreview({ locale }: { locale: AppLocale }) {
  const en = locale === "en";
  const [nodes, setNodes] = useState<GraphNode[]>(() => INITIAL_NODES.map((node) => ({ ...node })));
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const draggedNodeRef = useRef<GraphNode | null>(null);

  useEffect(() => {
    const graphNodes = INITIAL_NODES.map((node) => ({ ...node }));
    const graphLinks = INITIAL_LINKS.map((link) => ({ ...link }));
    const simulation = forceSimulation<GraphNode, GraphLink>(graphNodes)
      .force("link", forceLink<GraphNode, GraphLink>(graphLinks).id((node) => node.id).distance(115).strength(0.72))
      .force("charge", forceManyBody().strength(-330))
      .force("center", forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collision", forceCollide<GraphNode>(48))
      .alphaDecay(0.035)
      .on("tick", () => setNodes(graphNodes.map((node) => ({ ...node }))));
    simulationRef.current = simulation;
    return () => {
      simulation.stop();
    };
  }, []);

  const pointFromEvent = (event: React.PointerEvent<SVGGElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return null;
    return { x: ((event.clientX - rect.left) / rect.width) * WIDTH, y: ((event.clientY - rect.top) / rect.height) * HEIGHT };
  };

  const startDrag = (event: React.PointerEvent<SVGGElement>, node: GraphNode) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const sourceNode = simulationRef.current?.nodes().find((item) => item.id === node.id) ?? null;
    if (!sourceNode) return;
    draggedNodeRef.current = sourceNode;
    sourceNode.fx = node.x;
    sourceNode.fy = node.y;
    simulationRef.current?.alphaTarget(0.22).restart();
  };

  const moveDrag = (event: React.PointerEvent<SVGGElement>) => {
    const point = pointFromEvent(event);
    if (!point || !draggedNodeRef.current) return;
    draggedNodeRef.current.fx = Math.max(36, Math.min(WIDTH - 36, point.x));
    draggedNodeRef.current.fy = Math.max(36, Math.min(HEIGHT - 36, point.y));
  };

  const endDrag = (event: React.PointerEvent<SVGGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
    }
    draggedNodeRef.current = null;
    simulationRef.current?.alphaTarget(0);
  };

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return (
    <section className="col-span-full rounded-lg border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-neutral-950 dark:text-white">{en ? "Interactive relationship map" : "Mapa interactivo de relaciones"}</h3><p className="mt-1 text-xs text-neutral-500">{en ? "Drag any circle to explore how companies, shareholders and projects connect." : "Arrastre cualquier círculo para explorar cómo se conectan sociedades, accionistas y proyectos."}</p></div><div className="flex flex-wrap gap-3 text-[10px] text-neutral-500">{(["spv", "shareholder", "project"] as NodeKind[]).map((kind) => <span key={kind} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-neutral-400" style={{ backgroundColor: COLORS[kind] }} />{en ? { spv: "SPV", shareholder: "Shareholder", project: "Project" }[kind] : { spv: "SPV", shareholder: "Accionista", project: "Proyecto" }[kind]}</span>)}</div></div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 aspect-[2/1] w-full min-h-72 touch-none rounded-lg bg-neutral-50 dark:bg-neutral-900" role="img" aria-label={en ? "Fictional interactive graph of companies, shareholders and projects" : "Grafo interactivo ficticio de sociedades, accionistas y proyectos"}>
        <defs><marker id="ownership-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#38d7c5" /></marker></defs>
        {INITIAL_LINKS.map((link, index) => {
          const source = nodeById.get(typeof link.source === "string" ? link.source : link.source.id);
          const target = nodeById.get(typeof link.target === "string" ? link.target : link.target.id);
          if (!source || !target) return null;
          const midX = ((source.x ?? 0) + (target.x ?? 0)) / 2;
          const midY = ((source.y ?? 0) + (target.y ?? 0)) / 2;
          return <g key={index}><line x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#7ddfd3" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#ownership-arrow)" />{link.label && <text x={midX} y={midY - 6} textAnchor="middle" className="fill-neutral-600 text-[10px] font-semibold">{link.label}</text>}</g>;
        })}
        {nodes.map((node) => <g key={node.id} transform={`translate(${node.x ?? 0} ${node.y ?? 0})`} className="cursor-grab active:cursor-grabbing" onPointerDown={(event) => startDrag(event, node)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><circle r={node.kind === "spv" ? 39 : 32} fill={COLORS[node.kind]} stroke={node.kind === "project" ? "#38d7c5" : "#333333"} strokeWidth="2" className="drop-shadow-sm" /><foreignObject x={node.kind === "spv" ? -36 : -29} y={node.kind === "spv" ? -30 : -24} width={node.kind === "spv" ? 72 : 58} height={node.kind === "spv" ? 60 : 48} className="pointer-events-none"><div className={`flex h-full items-center justify-center text-center font-semibold leading-tight ${node.kind === "spv" ? "text-[9px] text-white" : "text-[8px] text-neutral-800"}`}>{node.label}</div></foreignObject></g>)}
      </svg>
    </section>
  );
}
