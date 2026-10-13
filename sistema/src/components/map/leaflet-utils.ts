import L from "leaflet";

export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function createMap(el: HTMLElement, center: [number, number], zoom: number): L.Map {
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView(center, zoom);
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer(OSM_TILES, { maxZoom: 19, attribution: OSM_ATTRIBUTION }).addTo(map);
  return map;
}

export function pinIcon(color: string, selected = false): L.DivIcon {
  const size = selected ? 32 : 26;
  return L.divIcon({
    className: "",
    html: `<span class="map-pin" style="background:${color};width:${size}px;height:${size}px${selected ? ";outline:2px solid #111;outline-offset:1px" : ""}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 2],
  });
}

export const pickIcon = () =>
  L.divIcon({
    className: "",
    html: '<span class="map-pin map-pin--pick"></span>',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
