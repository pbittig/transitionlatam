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
    line(`${point.technology ?? "Sin clasificar"}${point.capacityMw ? ` · ${point.capacityMw} MW` : ""}`),
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
    line(`${plant.technologyDetail ?? "Sin clasificar"}${plant.capacityMw ? ` · ${plant.capacityMw} MW` : ""}`),
  );
  if (plant.ownerName) root.appendChild(line(plant.ownerName));
  if (plant.status) root.appendChild(line(plant.status, { fontSize: "11px", color: "#888" }));
  return root;
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
        zoom: 3.6,
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
      el.style.backgroundColor = "light-dark(#2a78d6, #3987e5)";
      el.style.opacity = "0.75";
      el.style.border = "2px solid light-dark(#fcfcfb, #1a1a19)";
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
      el.style.backgroundColor = "light-dark(#eb6834, #d95926)";
      el.style.border = "2px solid light-dark(#fcfcfb, #1a1a19)";
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: 10 }).setDOMContent(pointPopupContent(point));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    }

    for (const plant of powerPlants) {
      const el = document.createElement("div");
      el.style.width = "9px";
      el.style.height = "9px";
      el.style.backgroundColor = "light-dark(#4a8f5c, #5cb571)";
      el.style.border = "1px solid light-dark(#fcfcfb, #1a1a19)";
      el.style.cursor = "pointer";

      const popup = new maplibregl.Popup({ offset: 8 }).setDOMContent(powerPlantPopupContent(plant));

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

  return <div ref={containerRef} className="h-[600px] w-full rounded-xl border border-neutral-200 dark:border-neutral-800" />;
}
