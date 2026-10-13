// Servicios geográficos públicos usados desde el navegador.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// Padrones urbanos de la Dirección Nacional de Catastro (mismos datos que GeoCatastro),
// publicados por el SIT del MVOT.
const CATASTRO = "https://sit.mvot.gub.uy/arcgis/rest/services/08_HERRAMIENTAS/BUSQUEDA_PADRONES/MapServer/0/query";

export interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

const upperNoAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** Busca una dirección en Uruguay (OpenStreetMap / Nominatim) */
export async function geocodeAddress(address: string, locality: string, department: string): Promise<GeoResult[]> {
  const q = [address, locality, department, "Uruguay"].filter(Boolean).join(", ");
  const params = new URLSearchParams({ format: "json", limit: "5", countrycodes: "uy", q });
  const res = await fetch(`${NOMINATIM}?${params}`, { headers: { "Accept-Language": "es" } });
  if (!res.ok) throw new Error("El servicio de búsqueda de direcciones no respondió.");
  const data = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  return data.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name }));
}

/** Ubica el centro de un padrón urbano según Catastro */
export async function locatePadron(padron: string, department: string, locality: string): Promise<GeoResult | null> {
  const n = padron.replace(/\D/g, "");
  if (!n) return null;
  const dept = upperNoAccents(department).replace(/'/g, "");
  const params = new URLSearchParams({
    where: `NOMDEPTO = '${dept}' AND PADRON = ${Number(n)}`,
    outFields: "NOMLOCCAT,NOMDEPTO",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  const res = await fetch(`${CATASTRO}?${params}`);
  if (!res.ok) throw new Error("El servicio de Catastro no respondió.");
  const data = (await res.json()) as {
    features?: { attributes: { NOMLOCCAT: string }; geometry: { rings: number[][][] } }[];
  };
  const features = data.features ?? [];
  if (!features.length) return null;
  // El mismo número puede repetirse en distintas localidades del departamento
  const wanted = upperNoAccents(locality);
  const f = features.find((x) => upperNoAccents(x.attributes.NOMLOCCAT) === wanted) ?? features[0];
  const ring = f.geometry.rings[0].slice(0, -1);
  const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lat, lng, label: `Padrón ${n} · ${f.attributes.NOMLOCCAT}` };
}
