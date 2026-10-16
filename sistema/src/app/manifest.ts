import type { MetadataRoute } from "next";

// Ficha de aplicación: con esto Edge (y el celular) pueden instalar el sistema como una
// aplicación propia, con el nombre "Estudio RF" y el logo en la barra de tareas.
// Se sirve en /manifest.webmanifest, que proxy.ts deja pasar sin sesión.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Estudio RF",
    short_name: "Estudio RF",
    description: "Sistema de gestión del estudio: obras, clientes, presupuestos y casas en alquiler.",
    lang: "es-UY",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#4a5664",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
