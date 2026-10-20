import type { BudgetSettings, CalcType } from "@/lib/types";
import { termAmount } from "./budget-text";

// Cuentas de la calculadora de presupuestos (todo en pesos).
// Para sumar un cálculo nuevo: agregar el valor en la plantilla (CalcType o BudgetSettings),
// calcularlo acá y mostrarlo en calculator-dialog.tsx.

export interface CalcResult {
  /** Honorarios sin IVA */
  fee: number | null;
  feeWithIva: number | null;
  terms: { label: string; percent: number; amount: number }[];
  wagesDays: number | null;
  wagesAmount: number | null;
  expenses: number | null;
  buildCost: number | null;
}

const round = (n: number) => Math.round(n);

export function calculate(t: BudgetSettings, type: CalcType | undefined, m2: number): CalcResult {
  const ok = Number.isFinite(m2) && m2 > 0;
  const fee = ok && type?.fee_per_m2 ? round(type.fee_per_m2 * m2) : null;
  const wagesDays = ok && type?.wages_per_m2 ? Math.ceil(type.wages_per_m2 * m2) : null;
  const hasExpenses = t.expenses_fixed !== null || t.expenses_per_m2 !== null;
  return {
    fee,
    feeWithIva: fee === null ? null : round(fee * (1 + t.iva_rate / 100)),
    terms: fee === null ? [] : t.payment_terms.map((x) => ({ ...x, amount: termAmount(fee, x.percent) })),
    wagesDays,
    wagesAmount: wagesDays !== null && t.wage_value ? round(wagesDays * t.wage_value) : null,
    expenses: ok && hasExpenses ? round((t.expenses_fixed ?? 0) + (t.expenses_per_m2 ?? 0) * m2) : null,
    buildCost: ok && type?.build_cost_per_m2 ? round(type.build_cost_per_m2 * m2) : null,
  };
}

/** Lo que pasa de la calculadora al presupuesto nuevo (por la dirección de la página) */
export interface CalcPrefill {
  tipo?: string;
  area?: string;
  precio?: number;
  jornales?: number;
  jornalesMonto?: number;
  gastos?: number;
}

export function prefillQuery(tipo: string, m2: number, r: CalcResult): string {
  const q = new URLSearchParams({ tipo, area: String(m2) });
  if (r.fee !== null) q.set("precio", String(r.fee));
  if (r.wagesDays !== null) q.set("jornales", String(r.wagesDays));
  if (r.wagesAmount !== null) q.set("jornalesMonto", String(r.wagesAmount));
  if (r.expenses !== null) q.set("gastos", String(r.expenses));
  return q.toString();
}

export function readPrefill(search: URLSearchParams): CalcPrefill | null {
  if (!search.has("area") && !search.has("precio")) return null;
  const n = (k: string) => {
    const v = Number(search.get(k));
    return search.has(k) && Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  return {
    tipo: search.get("tipo") ?? undefined,
    area: search.get("area") ?? undefined,
    precio: n("precio"),
    jornales: n("jornales"),
    jornalesMonto: n("jornalesMonto"),
    gastos: n("gastos"),
  };
}
