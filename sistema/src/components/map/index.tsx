"use client";

import dynamic from "next/dynamic";

// Leaflet necesita el navegador: se carga solo del lado del cliente.
const Loading = () => <div className="grid h-full w-full place-items-center bg-muted text-xs text-muted-foreground">Cargando mapa…</div>;

export const ProjectsMap = dynamic(() => import("./projects-map"), { ssr: false, loading: Loading });
export const LocationPicker = dynamic(() => import("./location-picker"), { ssr: false, loading: Loading });
