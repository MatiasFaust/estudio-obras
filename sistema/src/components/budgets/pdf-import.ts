// Lector de presupuestos en PDF (los hechos en Word con la hoja del estudio y los del sistema).
// Recibe el texto del PDF ya separado en renglones y busca cada dato por su forma:
// "P2177", "23 de octubre de 2026", "Sr. Nombre", "Honorarios: $ 36000", "– 50% ($ 18000)"…
// No importa nada del resto del sistema, así se puede probar suelto con Node.

import type { Currency, IvaMode, PaymentTerm } from "@/lib/types";

/** Un pedazo de texto del PDF con su posición (de pdf.js) */
export interface TextPiece {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** Lo que se pudo sacar de un PDF */
export interface ImportedBudget {
  number: string;
  issued_on: string | null;
  recipient: string;
  client_name: string;
  padron: string;
  address: string;
  service: string;
  intro: string;
  price: number | null;
  currency: Currency;
  iva_mode: IvaMode;
  payment_terms: PaymentTerm[];
  includes: string[];
  excludes: string;
  expenses_text: string;
  expenses_amount: number | null;
  wages_days: number | null;
  wages_amount: number | null;
  note: string;
  /** Lo que no se encontró (para revisarlo) */
  missing: string[];
}

/** Arma los renglones de una página: junta los pedazos que están a la misma altura, de izquierda a derecha */
export function piecesToLines(pieces: TextPiece[]): string[] {
  const sorted = pieces.filter((p) => p.str !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextPiece[][] = [];
  for (const p of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(row[0].y - p.y) <= 3) row.push(p);
    else rows.push([p]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    let text = "";
    let end = -Infinity;
    for (const p of row) {
      // Si hay un hueco entre dos pedazos y ninguno trae el espacio, se agrega
      if (text && p.x - end > 1.5 && !/\s$/.test(text) && !/^\s/.test(p.str)) text += " ";
      text += p.str;
      end = p.x + p.width;
    }
    return text.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/** Sin tildes y en minúscula, para comparar */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "36000", "102.000", "4.500,50" o "1,200.50" → número */
export function parseAmount(text: string): number | null {
  const v = text.replace(/[^\d.,]/g, "").replace(/[.,]$/, "");
  if (!/\d/.test(v)) return null;
  let n: string;
  if (/,\d{1,2}$/.test(v)) n = v.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(v) && /,/.test(v)) n = v.replace(/,/g, "");
  else n = v.replace(/[.,]/g, "");
  const out = Number(n);
  return Number.isFinite(out) ? out : null;
}

/** Monto con su moneda dentro de un texto: "US$ 4.500" → { amount: 4500, currency: "USD" } */
function moneyIn(text: string): { amount: number; currency: Currency } | null {
  const m = text.match(/(U\s?\$\s?S|US\s?\$|USD|U\$D|\$)\s*([\d][\d.,]*)/i);
  if (!m) return null;
  const amount = parseAmount(m[2]);
  if (amount === null) return null;
  return { amount, currency: /u/i.test(m[1]) ? "USD" : "UYU" };
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const lowerFirst = (s: string) => (s && !/^[A-ZÁÉÍÓÚÑ]{2}/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** Saca guiones, viñetas y espacios de las puntas */
const trimMarks = (s: string) => s.replace(/^[\s\-–—•·*]+|[\s\-–—•·*:]+$/g, "").trim();

// Renglones que empiezan otra parte del presupuesto (cortan la anterior)
const SECTION = /^(precio|honorarios|forma de pago|el proyecto incluye|el presupuesto incluye|incluye|no se incluye|no incluye|gastos|estimado de jornales|jornales|nota\b|observaciones|saluda|sin otro particular|atentamente)/;

/** Lee el presupuesto a partir de los renglones del PDF y el nombre del archivo */
export function parseBudgetLines(rawLines: string[], fileName: string): ImportedBudget {
  const lines = rawLines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const low = lines.map(plain);
  const findLine = (re: RegExp, from = 0) => {
    for (let i = from; i < low.length; i++) if (re.test(low[i])) return i;
    return -1;
  };
  const sectionEnd = (from: number) => {
    const i = findLine(SECTION, from);
    return i === -1 ? lines.length : i;
  };
  const missing: string[] = [];

  // Número: "P2177" en el encabezado o, si no, el del nombre del archivo ("2177.PRES.pdf")
  const pNumber = lines.map((l) => l.match(/^P\s?-?\s?(\d{3,6})$/i)?.[1]).find(Boolean);
  const number = pNumber ?? fileName.match(/^\D{0,20}?(\d{3,6})/)?.[1] ?? "";
  if (!number) missing.push("número");

  // Fecha: "23 de octubre de 2026"
  let issued_on: string | null = null;
  let dateLine = -1;
  for (let i = 0; i < low.length && dateLine === -1; i++) {
    const m = low[i].match(/(\d{1,2}) de ([a-z]+) (?:de|del) (\d{4})/);
    if (m && MONTHS[m[2]]) {
      issued_on = `${m[3]}-${String(MONTHS[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      dateLine = i;
    }
  }
  if (!issued_on) missing.push("fecha");

  // Destinatario: el renglón antes del saludo ("De mi mayor consideración:")
  const greeting = findLine(/consideracion|^estimad[oa]s?\b|^de nuestra mayor/);
  let recipientLine = greeting > 0 ? greeting - 1 : dateLine >= 0 ? dateLine + 1 : -1;
  if (recipientLine >= 0 && (recipientLine === dateLine || /^p\s?\d{3,6}$/.test(low[recipientLine]))) recipientLine = -1;
  const recipient = recipientLine >= 0 ? lines[recipientLine] : "";
  const client_name = recipient.replace(/^(sr(es|as|a|ta)?\.?|señor(es|as|a)?)\s+/i, "").trim();
  if (!client_name) missing.push("cliente");

  // Precio u honorarios (a veces el monto está en el renglón de abajo)
  const priceLine = findLine(/^(precio|honorarios)\b/);
  const priceText = priceLine >= 0 ? `${lines[priceLine]} ${moneyIn(lines[priceLine]) ? "" : lines[priceLine + 1] ?? ""}` : "";
  const price = moneyIn(priceText);
  if (!price) missing.push("honorarios");
  const priceLow = plain(priceText);
  const iva_mode: IvaMode = /iva incluido/.test(priceLow) ? "iva_incluido" : /(\+|mas) ?iva/.test(priceLow) ? "mas_iva" : "sin_iva";

  // Presentación: lo que está entre el saludo y el precio
  const introFrom = greeting >= 0 ? greeting + 1 : recipientLine >= 0 ? recipientLine + 1 : 0;
  const introTo = priceLine > introFrom ? priceLine : sectionEnd(introFrom);
  const intro = lines.slice(introFrom, introTo).join(" ").trim();
  const padron = intro.match(/padr[oó]n(?:es)?\s*(?:n[º°o.]*\s*)?:?\s*(\d[\d/.\-]*\d|\d)/i)?.[1] ?? "";
  const address = trimMarks(intro.match(/ubicad[oa] en\s+(.+?)(?:,|\.\s|\.$|$)/i)?.[1] ?? "");
  let service = intro.match(/trabajos? de\s+(.+?)(?:,|\s+aproximad|\s+[áa]rea\b|\s+de\s+\d+\s*m|\s+padr[oó]n|\s+ubicad|\.\s|\.$|$)/i)?.[1] ?? "";
  service = capitalize(service.replace(/^presentaci[oó]n de\s+/i, "").trim()).slice(0, 160);

  // Forma de pago: "- Al comenzar los trabajos – 50% ($ 18000)" o "35% al comenzar los trabajos (US$ 16.800)"
  const payment_terms: PaymentTerm[] = [];
  const termsLine = findLine(/^forma de pago/);
  if (termsLine >= 0) {
    const end = sectionEnd(termsLine + 1);
    const first = lines[termsLine].replace(/^forma de pago\s*:?/i, "");
    for (const l of [first, ...lines.slice(termsLine + 1, end)]) {
      const pct = l.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (!pct) continue;
      const label = trimMarks(l.replace(/\([^)]*\)/g, " ").replace(pct[0], " ").replace(/\s+/g, " "));
      payment_terms.push({ percent: Number(pct[1].replace(",", ".")), label: lowerFirst(trimMarks(label)) });
    }
  }

  // Qué incluye: cada "-" empieza una cosa; los renglones sin guion siguen la anterior
  const includes: string[] = [];
  const incLine = findLine(/^(el proyecto incluye|el presupuesto incluye|incluye)/);
  if (incLine >= 0) {
    const end = sectionEnd(incLine + 1);
    const rest = lines[incLine].replace(/^.*?incluye\s*:?/i, "").trim();
    for (const l of [rest, ...lines.slice(incLine + 1, end)].filter(Boolean)) {
      if (/^[-–—•·*]/.test(l) || !includes.length) includes.push(trimMarks(l));
      else includes[includes.length - 1] += ` ${l}`;
    }
  }

  const excludesLine = findLine(/^no (se )?incluye/);
  const excludes = excludesLine >= 0 ? lines[excludesLine] : "";

  // Gastos: "Gastos: copia de planos, timbres…, se estiman en $ 1.200"
  let expenses_text = "";
  let expenses_amount: number | null = null;
  const expLine = findLine(/^gastos/);
  if (expLine >= 0) {
    const text = lines.slice(expLine, sectionEnd(expLine + 1)).join(" ").replace(/^gastos\s*:?\s*/i, "");
    const [desc, est] = text.split(/,?\s*se estima[n]? en\s*/i);
    expenses_text = trimMarks(desc ?? "");
    expenses_amount = est ? moneyIn(est)?.amount ?? parseAmount(est) : null;
  }

  // Jornales: "Estimado de jornales: 129 J; aproximado $ 283.800"
  let wages_days: number | null = null;
  let wages_amount: number | null = null;
  const wagesLine = findLine(/^(estimado de )?jornales/);
  if (wagesLine >= 0) {
    const text = lines[wagesLine];
    const days = text.match(/(\d[\d.,]*)\s*J\b/i);
    wages_days = days ? parseAmount(days[1]) : null;
    wages_amount = moneyIn(text.replace(/^[^;]*J\b/i, ""))?.amount ?? null;
  }

  // Nota (puede seguir en los renglones de abajo)
  const noteLine = findLine(/^(nota|observaciones)\b/);
  const note = noteLine >= 0
    ? lines.slice(noteLine, sectionEnd(noteLine + 1)).join(" ").replace(/^(nota|observaciones)\s*:?\s*/i, "").trim()
    : "";

  return {
    number, issued_on, recipient, client_name, padron, address, service, intro,
    price: price?.amount ?? null, currency: price?.currency ?? "UYU", iva_mode,
    payment_terms, includes, excludes, expenses_text, expenses_amount, wages_days, wages_amount, note, missing,
  };
}
