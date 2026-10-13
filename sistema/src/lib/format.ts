import { format, formatDistanceToNow, isBefore, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

/** "2026-10-12" → "12 oct 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy", { locale: es });
}

export function formatDateTime(value: string): string {
  return format(parseISO(value), "d MMM yyyy, HH:mm", { locale: es });
}

export function timeAgo(value: string): string {
  return formatDistanceToNow(parseISO(value), { addSuffix: true, locale: es });
}

export function isOverdue(date: string | null | undefined): boolean {
  if (!date) return false;
  return isBefore(parseISO(date), startOfDay(new Date()));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Normaliza para búsquedas sin tildes ni mayúsculas */
export function normalize(text: string | null | undefined): string {
  return (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return fields.some((f) => normalize(f).includes(q));
}
