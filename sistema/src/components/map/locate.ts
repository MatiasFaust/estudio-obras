// Busca dónde queda una obra en el servicio público de direcciones del Estado (IDE Uruguay):
// primero por padrón y, si no aparece, por su dirección. Solo se le manda padrón y dirección.
// https://direcciones.ide.uy/swagger-ui.html
// No importa nada del resto del sistema, así se puede probar suelto con Node.

import type { Project } from "@/lib/types";

const API = "https://direcciones.ide.uy/api/v1/geocode";

interface Hit {
  type: string;
  address: string;
  localidad: string;
  lat: number;
  lng: number;
  /** 1 = coincidencia exacta; 2 = aproximada (devuelve cualquier calle parecida) */
  state: number;
}

export interface Located {
  lat: number;
  lng: number;
  /** Lo que encontró el servicio, ej.: "MANZANA 218 SOLAR 6, PAYSANDU, PAYSANDU" */
  place: string;
  source: "padron" | "direccion";
  /** Por qué conviene mirarla antes de guardarla */
  doubt: string | null;
}

/** Como escribe los nombres el servicio: "Paysandú" → "PAYSANDU" */
const upper = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();

/** Metros entre dos puntos */
function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

async function query(path: string, params: Record<string, string>): Promise<Hit[]> {
  const res = await fetch(`${API}/${path}?${new URLSearchParams(params)}`);
  // Cuando no encuentra el padrón, el servicio responde con error 500
  if (!res.ok) return [];
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as Hit[]).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng)) : [];
}

/** "6191/006" → "6191" (la parte de después es la unidad dentro del padrón) */
export const padronNumber = (padron: string | null) => padron?.match(/\d+/)?.[0] ?? null;

/** Por dirección: solo si coincide exacto y con número de puerta o esquina (no alcanza con la calle) */
async function byAddress(p: Project): Promise<Hit | null> {
  if (/^(padr[oó]n\b|sin direcci)/i.test(p.address.trim())) return null;
  // "Roger Ballet 2179.001" → "Roger Ballet 2179"; "Argento y Colón" → "Argento esquina Colón"
  const street = p.address.replace(/(\d)\.\d+/g, "$1").replace(/ y /i, " esquina ").trim();
  const [hit] = await query("direcUnica", { q: `${street}, ${p.locality}, ${p.department}`, limit: "1" });
  return hit?.state === 1 && ["CALLEyPORTAL", "ESQUINA"].includes(hit.type) ? hit : null;
}

/** Dónde queda una obra, o null si no aparece. Si no se puede consultar el servicio, da error */
export async function locateProject(p: Project): Promise<Located | null> {
  const number = padronNumber(p.padron);
  const department = upper(p.department);
  const locality = upper(p.locality);
  let hits: Hit[] = [];
  if (number) {
    // En la localidad de la obra y, si esa no la conoce el servicio, en la capital del departamento
    for (const l of new Set([locality, department])) {
      hits = await query("direcPadron", { departamento: department, localidad: l, padron: number, limit: "5" });
      if (hits.length) break;
    }
  }
  const address = await byAddress(p);
  const hit = hits[0];
  if (!hit) return address && { lat: address.lat, lng: address.lng, place: address.address, source: "direccion", doubt: null };

  let doubt: string | null = null;
  if (hits.some((h) => meters(h, hit) > 150)) doubt = "El padrón aparece en más de un lugar.";
  else if (upper(hit.localidad) !== locality) doubt = `El padrón apareció en ${hit.localidad} y la obra dice ${p.locality}: puede ser otro con el mismo número.`;
  else if (address && meters(address, hit) > 300) doubt = `La dirección de la obra queda a ${Math.round(meters(address, hit))} metros de este padrón.`;
  return { lat: hit.lat, lng: hit.lng, place: hit.address, source: "padron", doubt };
}
