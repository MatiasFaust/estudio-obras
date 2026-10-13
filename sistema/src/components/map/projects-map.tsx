"use client";

import L from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { PAYSANDU_CENTER, PROJECT_TYPES, STATUS, statusColor } from "@/lib/constants";
import { googleMapsUrl } from "@/lib/format";
import type { Client, Project } from "@/lib/types";
import { createMap, pinIcon } from "./leaflet-utils";

export interface ProjectsMapProps {
  projects: Project[];
  clients: Client[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Al cambiar, ajusta la vista a todas las obras visibles */
  fitKey?: string;
  /** Clic en un punto vacío del mapa */
  onMapClick?: (point: { lat: number; lng: number }) => void;
  className?: string;
}

function popupContent(p: Project, client: Client | undefined, open: (href: string) => void): HTMLElement {
  const root = document.createElement("div");
  root.className = "grid gap-1 min-w-48";

  const title = document.createElement("strong");
  title.className = "text-sm font-semibold";
  title.textContent = p.name;

  const meta = document.createElement("div");
  meta.className = "text-xs text-muted-foreground";
  meta.textContent = `${p.code} · ${PROJECT_TYPES[p.project_type]}`;

  const address = document.createElement("div");
  address.textContent = `${p.address}, ${p.locality}`;

  const clientEl = document.createElement("div");
  clientEl.textContent = `Cliente: ${client?.name ?? "—"}`;

  const status = document.createElement("div");
  status.className = "flex items-center gap-1.5";
  const dot = document.createElement("span");
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:9999px;background:${statusColor(p.status)}`;
  status.append(dot, document.createTextNode(`${STATUS[p.status].label} · ${p.progress}%`));

  const links = document.createElement("div");
  links.className = "mt-1.5 flex gap-3 text-xs font-medium";
  const detail = document.createElement("a");
  detail.href = `/obras/${p.id}`;
  detail.textContent = "Ver ficha →";
  detail.className = "text-primary";
  detail.addEventListener("click", (e) => {
    e.preventDefault();
    open(`/obras/${p.id}`);
  });
  links.append(detail);
  if (p.lat !== null && p.lng !== null) {
    const gm = document.createElement("a");
    gm.href = googleMapsUrl(p.lat, p.lng);
    gm.target = "_blank";
    gm.rel = "noopener noreferrer";
    gm.textContent = "Google Maps";
    gm.className = "text-muted-foreground";
    links.append(gm);
  }

  root.append(title, meta, address, clientEl, status, links);
  return root;
}

export default function ProjectsMap({ projects, clients, selectedId, onSelect, fitKey, onMapClick, className }: ProjectsMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const router = useRouter();
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
  });

  useEffect(() => {
    if (!el.current) return;
    const map = createMap(el.current, PAYSANDU_CENTER, 14);
    map.on("click", (e: L.LeafletMouseEvent) => onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Marcadores
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.current.clear();
    const byId = new Map(clients.map((c) => [c.id, c]));
    for (const p of projects) {
      if (p.lat === null || p.lng === null) continue;
      const marker = L.marker([p.lat, p.lng], {
        icon: pinIcon(statusColor(p.status), p.id === selectedId),
        title: p.name,
        zIndexOffset: p.id === selectedId ? 1000 : 0,
      })
        .bindPopup(popupContent(p, p.client_id ? byId.get(p.client_id) : undefined, (href) => router.push(href)), {
          closeButton: false,
          autoPanPadding: [40, 40],
        })
        .on("click", () => onSelectRef.current?.(p.id));
      marker.addTo(layer);
      markers.current.set(p.id, marker);
    }
  }, [projects, clients, selectedId, router]);

  // Encuadre de todas las obras visibles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === undefined) return;
    const points = projects.filter((p) => p.lat !== null && p.lng !== null).map((p) => [p.lat!, p.lng!] as [number, number]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 16);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Centrar la obra seleccionada
  useEffect(() => {
    const m = selectedId ? markers.current.get(selectedId) : undefined;
    if (!m || !mapRef.current) return;
    mapRef.current.flyTo(m.getLatLng(), Math.max(mapRef.current.getZoom(), 16), { duration: 0.5 });
    m.openPopup();
  }, [selectedId]);

  return <div ref={el} className={className} role="application" aria-label="Mapa de obras" />;
}
