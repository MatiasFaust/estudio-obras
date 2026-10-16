import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Budget, BudgetSettings, Currency, IvaMode, Project } from "@/lib/types";

// Textos del presupuesto que comparten el editor y el PDF.

/** "$ 102.000" o "US$ 4.500,50" (sin decimales si es un número entero, como en los presupuestos del estudio) */
export function money(amount: number, currency: Currency): string {
  const n = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency === "USD" ? "US$" : "$"} ${n}`;
}

export const IVA_LABEL: Record<IvaMode, string> = {
  mas_iva: "+ IVA",
  iva_incluido: "IVA incluido",
  sin_iva: "Sin IVA",
};

export function priceLine(b: Pick<Budget, "price" | "currency" | "iva_mode">): string {
  if (b.price === null) return "Precio: a definir";
  const base = `Precio: ${money(b.price, b.currency)}`;
  if (b.iva_mode === "mas_iva") return `${base} + IVA`;
  if (b.iva_mode === "iva_incluido") return `${base} (IVA incluido)`;
  return base;
}

/** Monto de una cuota según su porcentaje (redondeado a pesos/dólares enteros) */
export const termAmount = (price: number, percent: number) => Math.round((price * percent) / 100);

/** "27 de Noviembre de 2025" */
export function longDate(iso: string): string {
  const s = format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: es });
  return s.replace(/ de ([a-zé]+) de /, (_, m: string) => ` de ${m.charAt(0).toUpperCase()}${m.slice(1)} de `);
}

/** Párrafo de presentación a partir de la plantilla y los datos de la obra */
export function fillIntro(template: string, data: { trabajo: string; area: string; padron: string }): string {
  return template
    .replaceAll("{trabajo}", data.trabajo || "…")
    .replaceAll("{area}", data.area || "…")
    .replaceAll("{padron}", data.padron || "…");
}

export const defaultTrabajo = (p: Project) => `presentación de proyecto de ${p.name.toLowerCase()}`;

/**
 * Formato mínimo dentro de los textos: **negrita** y __subrayado__.
 * Devuelve los tramos para dibujarlos en el PDF.
 */
export interface Span {
  text: string;
  bold?: boolean;
  underline?: boolean;
}

export function parseMarks(text: string): Span[] {
  const out: Span[] = [];
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) out.push({ text: m[2], bold: true });
    else out.push({ text: m[3], underline: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Valores iniciales de un presupuesto nuevo, tomados de la plantilla y de la obra */
export function newBudgetFrom(settings: BudgetSettings, project: Project, clientName: string | undefined) {
  const trabajo = defaultTrabajo(project);
  return {
    project_id: project.id,
    number: "",
    issued_on: format(new Date(), "yyyy-MM-dd"),
    recipient: clientName ?? "",
    intro: fillIntro(settings.intro, { trabajo, area: "", padron: project.padron ?? "" }),
    price: null,
    currency: "UYU" as Currency,
    iva_mode: "mas_iva" as IvaMode,
    payment_terms: settings.payment_terms.map((t) => ({ ...t })),
    includes: [...settings.includes],
    excludes: settings.excludes,
    expenses_text: settings.expenses_text,
    expenses_amount: null,
    wages_days: null,
    wages_amount: null,
    note: settings.note,
    status: "borrador" as const,
  };
}
