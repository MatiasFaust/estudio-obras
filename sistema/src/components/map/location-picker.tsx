"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { PAYSANDU_CENTER } from "@/lib/constants";
import { createMap, pickIcon } from "./leaflet-utils";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Mapa para marcar la ubicación de una obra (clic o arrastrar el marcador) */
export default function LocationPicker({
  value,
  onChange,
  flyTo,
  className,
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  /** Cambia cuando una búsqueda encuentra un punto: centra el mapa ahí */
  flyTo?: { point: LatLng; zoom: number; key: number } | null;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!el.current) return;
    const start = value ? ([value.lat, value.lng] as [number, number]) : PAYSANDU_CENTER;
    const map = createMap(el.current, start, value ? 17 : 14);
    mapRef.current = map;
    map.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // El mapa se crea una sola vez; los cambios de valor se aplican en el efecto siguiente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      const m = L.marker([value.lat, value.lng], { icon: pickIcon(), draggable: true }).addTo(map);
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current({ lat: p.lat, lng: p.lng });
      });
      markerRef.current = m;
    }
  }, [value]);

  useEffect(() => {
    if (flyTo && mapRef.current) mapRef.current.flyTo([flyTo.point.lat, flyTo.point.lng], flyTo.zoom, { duration: 0.5 });
  }, [flyTo]);

  return <div ref={el} className={className} role="application" aria-label="Seleccionar ubicación en el mapa" />;
}
