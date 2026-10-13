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

/** 12500 → "$ 12.500,00"  ·  1200 (USD) → "US$ 1.200,00" */
export function formatMoney(amount: number | null | undefined, currency: "UYU" | "USD"): string {
  if (amount === null || amount === undefined) return "—";
  const n = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `${currency === "USD" ? "US$" : "$"} ${n}`;
}

/** Convierte un pago a la moneda acordada (cotización = pesos por dólar) */
export function convertAmount(amount: number, from: "UYU" | "USD", to: "UYU" | "USD", rate: number | null): number | null {
  if (from === to) return amount;
  if (!rate) return null;
  return Math.round((from === "UYU" ? amount / rate : amount * rate) * 100) / 100;
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
