import { format } from "date-fns";
import type { DevLease, DevRentPayment } from "./types";

// Cálculos del estudio de desarrollo: contratos vigentes y alquileres adeudados.
// Las fechas se comparan como texto AAAA-MM-DD, en hora local (ver CLAUDE.md).

export const today = () => format(new Date(), "yyyy-MM-dd");

/** Último día en que el contrato está vigente (null = sin fecha de fin) */
export function leaseLastDay(l: DevLease): string | null {
  const days = [l.end_date, l.terminated_on].filter((d): d is string => !!d).sort();
  return days[0] ?? null;
}

export function isLeaseActive(l: DevLease, on = today()): boolean {
  const last = leaseLastDay(l);
  return l.start_date <= on && (last === null || last >= on);
}

/** Días que faltan para que venza el contrato (null si no tiene fecha de fin) */
export function daysToEnd(l: DevLease, on = today()): number | null {
  const last = leaseLastDay(l);
  if (!last) return null;
  return Math.round((Date.parse(`${last}T12:00:00`) - Date.parse(`${on}T12:00:00`)) / 86_400_000);
}

export interface MonthStatus {
  /** AAAA-MM-01 */
  period: string;
  /** Fecha de vencimiento del mes */
  due: string;
  paid: number;
  owed: number;
}

/**
 * Meses del contrato ya vencidos (hasta hoy y hasta el fin del contrato),
 * con lo pagado y lo adeudado en cada uno.
 */
export function leaseMonths(l: DevLease, payments: DevRentPayment[], on = today()): MonthStatus[] {
  const last = leaseLastDay(l);
  const own = payments.filter((p) => p.lease_id === l.id);
  const out: MonthStatus[] = [];
  const [y, m] = l.start_date.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  for (;;) {
    const period = format(d, "yyyy-MM-01");
    const due = format(new Date(d.getFullYear(), d.getMonth(), l.due_day), "yyyy-MM-dd");
    if (due > on || (last !== null && period > last)) break;
    const paid = own.filter((p) => p.period === period).reduce((a, p) => a + p.amount, 0);
    out.push({ period, due, paid, owed: Math.max(0, Math.round((l.rent_amount - paid) * 100) / 100) });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

export interface LeaseBalance {
  owed: number;
  monthsOwed: number;
  lastPaidOn: string | null;
}

export function leaseBalance(l: DevLease, payments: DevRentPayment[], on = today()): LeaseBalance {
  const months = leaseMonths(l, payments, on);
  const lastPaidOn = payments
    .filter((p) => p.lease_id === l.id)
    .reduce<string | null>((max, p) => (!max || p.paid_on > max ? p.paid_on : max), null);
  return {
    owed: months.reduce((a, x) => a + x.owed, 0),
    monthsOwed: months.filter((x) => x.owed > 0).length,
    lastPaidOn,
  };
}

/** "Octubre de 2026" */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("es-UY", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mes actual como AAAA-MM-01 */
export const currentPeriod = () => format(new Date(), "yyyy-MM-01");
