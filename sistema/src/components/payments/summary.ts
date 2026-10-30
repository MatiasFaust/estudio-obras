import type { Budget, Currency, Finance, Payment } from "@/lib/types";

type Agreement = Pick<Finance, "agreed_amount" | "currency">;

/** En un presupuesto sin obra, lo acordado son sus honorarios */
export const budgetAgreement = (b: Pick<Budget, "price" | "currency">): Agreement => ({ agreed_amount: b.price, currency: b.currency });

export interface PaymentSummary {
  currency: Currency;
  agreed: number | null;
  paid: number;
  balance: number | null;
  /** Porcentaje pagado del monto acordado (0–100), null si no hay monto acordado */
  percent: number | null;
  count: number;
  lastPaidOn: string | null;
}

/**
 * Pagos de un presupuesto. Con obra: los de la obra, sobre su monto acordado (si la obra todavía
 * no tiene, sobre los honorarios del presupuesto). Sin obra: los suyos, sobre los honorarios.
 */
export function budgetPayments(b: Budget, finances: Finance[], payments: Payment[]) {
  const finance = b.project_id ? finances.find((f) => f.project_id === b.project_id) : undefined;
  const hasAgreement = finance?.agreed_amount != null;
  const own = payments.filter((p) => (b.project_id ? p.project_id === b.project_id : p.budget_id === b.id));
  return { finance, hasAgreement, own, summary: summarize(hasAgreement ? finance : budgetAgreement(b), own) };
}

/** Resumen del avance de pago de una obra o presupuesto (montos en la moneda acordada) */
export function summarize(finance: Agreement | undefined, payments: Payment[]): PaymentSummary {
  const currency = finance?.currency ?? payments[0]?.currency ?? "UYU";
  const paid = Math.round(payments.reduce((a, p) => a + p.amount_contract, 0) * 100) / 100;
  const agreed = finance?.agreed_amount ?? null;
  return {
    currency,
    agreed,
    paid,
    balance: agreed === null ? null : Math.round((agreed - paid) * 100) / 100,
    percent: agreed ? Math.min(100, Math.round((paid / agreed) * 100)) : null,
    count: payments.length,
    lastPaidOn: payments.reduce<string | null>((m, p) => (!m || p.paid_on > m ? p.paid_on : m), null),
  };
}
