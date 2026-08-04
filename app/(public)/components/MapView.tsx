"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapPoint, RegionBubble } from "@/lib/data-access/projects";
import type { PowerPlantMapPoint } from "@/lib/data-access/powerPlants";

// Estilo demo público de MapLibre — sin API key. Cambiar por un proveedor con
// key (MapTiler/Protomaps, ver docs/05-arquitectura-tecnica.md §5.5) cuando
// se necesite más definición visual.
const MAP_STYLE = "https://demotiles.maplibre.org/style.json";

function applyTransitionMapTheme(map: maplibregl.Map) {
  map.setProjection({ type: "globe" });
  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    const id = layer.id;
    const normalizedId = id.toLowerCase();
    try {
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", "#123f3a");
      } else if (layer.type === "fill") {
        const isWater = /water|ocean|sea/.test(normalizedId);
        const isPark = /park|forest|wood|grass|landcover/.test(normalizedId);
        map.setPaintProperty(id, "fill-color", isWater ? "#123f3a" : isPark ? "#aebdb6" : "#d9ddda");
        map.setPaintProperty(id, "fill-opacity", isWater ? 1 : 0.96);
      } else if (layer.type === "line") {
        const isBoundary = /boundary|admin|border/.test(normalizedId);
        map.setPaintProperty(id, "line-color", isBoundary ? "#82948e" : "#b8c0bc");
        map.setPaintProperty(id, "line-opacity", isBoundary ? 0.75 : 0.5);
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", "#344740");
        map.setPaintProperty(id, "text-halo-color", "#eef0ee");
        map.setPaintProperty(id, "text-halo-width", 1);
      }
    } catch {
      // Algunos estilos demo no admiten modificar todas sus capas; las demás
      // siguen recibiendo el tema sin impedir que el mapa cargue.
    }
  }
}

function bubbleRadius(count: number, maxCount: number): number {
  const min = 8;
  const max = 34;
  return min + (max - min) * Math.sqrt(count / maxCount);
}

function line(text: string, style?: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const div = document.createElement("div");
  div.textContent = text;
  if (style) Object.assign(div.style, style);
  return div;
}

function formatCapacityMw(value: number | null | undefined): string {
  return value == null
    ? ""
    : `${value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MW`;
}

function regionPopupContent(bubble: RegionBubble): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = bubble.region;
  root.appendChild(title);
  root.appendChild(
    line(`${bubble.count.toLocaleString("es-CL")} proyectos · ${Math.round(bubble.capacityMw).toLocaleString("es-CL")} MW`),
  );
  root.appendChild(line("Ubicación aproximada (centroide regional)", { fontSize: "11px", color: "#888" }));
  return root;
}

function pointPopupContent(point: MapPoint): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = point.name;
  root.appendChild(title);
  root.appendChild(
    line(`${point.technology ?? "Sin clasificar"}${point.capacityMw != null ? ` · ${formatCapacityMw(point.capacityMw)}` : ""}`),
  );
  const link = document.createElement("a");
  link.href = `/proyectos/${point.id}`;
  link.style.color = "#2a78d6";
  link.textContent = "Ver proyecto →";
  root.appendChild(link);
  return root;
}

function powerPlantPopupContent(plant: PowerPlantMapPoint): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = plant.name;
  root.appendChild(title);
  root.appendChild(
    line(`${plant.technologyDetail ?? "Sin clasificar"}${plant.capacityMw != null ? ` · ${formatCapacityMw(plant.capacityMw)}` : ""}`),
  );
  if (plant.ownerName) root.appendChild(line(plant.ownerName));
  if (plant.status) root.appendChild(line(plant.status, { fontSize: "11px", color: "#888" }));
  return root;
}

function powerPlantMarkerAppearance(plant: PowerPlantMapPoint): { icon: string; color: string; label: string } {
  const technology = `${plant.plantType ?? ""} ${plant.technologyDetail ?? ""}`.toLowerCase();
  if (/solar|fotovolta/.test(technology)) return { icon: "☀", color: "#d97706", label: "Solar" };
  if (/eólic|eolic|wind/.test(technology)) return { icon: "≋", color: "#2563eb", label: "Eólica" };
  if (/hidro|hydro/.test(technology)) return { icon: "●", color: "#0891b2", label: "Hidroeléctrica" };
  if (/bess|bater|almacen/.test(technology)) return { icon: "▰", color: "#7c3aed", label: "Almacenamiento" };
  if (/geoterm/.test(technology)) return { icon: "♨", color: "#dc2626", label: "Geotérmica" };
  if (/biomasa|biogas|biogás/.test(technology)) return { icon: "◆", color: "#16a34a", label: "Biomasa" };
  return { icon: "●", color: "#64748b", label: plant.technologyDetail ?? "Otra tecnología" };
}

export function MapView({
  regionBubbles,
  precisePoints,
  powerPlants = [],
}: {
  regionBubbles: RegionBubble[];
  precisePoints: MapPoint[];
  powerPlants?: PowerPlantMapPoint[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  // maplibre-gl lanza sincrónicamente si no puede crear el contexto WebGL (ej.
  // navegador sandboxeado, aceleración por hardware deshabilitada) — sin este
  // try/catch, el error se propaga fuera del efecto y React tumba toda la página
  // (hallazgo real, /proyectos-esperados). Se degrada a un mensaje en vez de romper.
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [-71.5, -35.6],
        zoom: 3.35,
        pitch: 18,
        bearing: -7,
        canvasContextAttributes: { antialias: true },
      });
      mapRef.current.on("style.load", () => {
        if (mapRef.current) applyTransitionMapTheme(mapRef.current);
      });
      mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
    } catch (err) {
      const message = (err as Error).message || "No se pudo inicializar el mapa.";
      // Diferido a un microtask: setState sincrónico dentro del cuerpo del efecto
      // dispara la regla react-hooks/set-state-in-effect (cascading renders).
      queueMicrotask(() => setMapError(message));
      return;
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const maxCount = Math.max(...regionBubbles.map((b) => b.count), 1);

    for (const bubble of regionBubbles) {
      const el = document.createElement("div");
      const size = bubbleRadius(bubble.count, maxCount);
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = "rgba(32, 199, 165, 0.74)";
      el.style.boxShadow = "0 0 0 5px rgba(32, 199, 165, 0.13), 0 5px 16px rgba(5, 63, 57, 0.28)";
      el.style.border = "2px solid rgba(238, 255, 250, 0.95)";
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: size / 2 + 6 }).setDOMContent(regionPopupContent(bubble));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([bubble.lng, bubble.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }

    for (const point of precisePoints) {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = "#0f766e";
      el.style.boxShadow = "0 0 0 4px rgba(15, 118, 110, 0.16)";
      el.style.border = "2px solid #eafff8";
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: 10 }).setDOMContent(pointPopupContent(point));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }

    for (const plant of powerPlants) {
      const appearance = powerPlantMarkerAppearance(plant);
      const el = document.createElement("div");
      el.textContent = appearance.icon;
      el.title = `${appearance.label}: ${plant.name}`;
      el.setAttribute("aria-label", `${appearance.label}: ${plant.name}`);
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.borderRadius = "9999px";
      el.style.backgroundColor = appearance.color;
      el.style.color = "white";
      el.style.fontSize = "14px";
      el.style.fontWeight = "700";
      el.style.lineHeight = "1";
      el.style.border = "2px solid rgba(255,255,255,.95)";
      el.style.boxShadow = "0 2px 8px rgba(24, 54, 47, 0.38)";
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: 14 }).setDOMContent(powerPlantPopupContent(plant));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([plant.lng, plant.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [regionBubbles, precisePoints, powerPlants]);

  if (mapError) {
    return (
      <div className="flex h-[600px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No se pudo cargar el mapa en este navegador (WebGL no disponible).
        </p>
        <p className="max-w-md text-xs text-neutral-400 dark:text-neutral-600">
          El resto de la página funciona con normalidad — prueba con otro navegador o revisando la aceleración por
          hardware si necesitas ver el mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-primary/25 bg-brand-ink shadow-inner">
      <div className="pointer-events-none absolute top-4 left-4 z-10 rounded-full border border-white/15 bg-brand-ink/80 px-3 py-1.5 text-xs font-medium text-white/80 shadow-lg backdrop-blur">
        Vista geoespacial · Chile
      </div>
      <div ref={containerRef} className="h-[600px] w-full" />
    </div>
  );
}
