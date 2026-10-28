import type { BudgetKind, BudgetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Estado del presupuesto (en este orden aparecen en los filtros y selectores) */
export const BUDGET_STATUS: Record<BudgetStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  aceptado: { label: "Aceptado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  en_ejecucion: { label: "En ejecución", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  finalizado: { label: "Finalizado", className: "bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  rechazado: { label: "Rechazado", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export const BUDGET_STATUS_OPTIONS = Object.entries(BUDGET_STATUS).map(([value, s]) => ({ value, label: s.label }));

/** Estados en los que el presupuesto ya se está cobrando (con obra, su precio es el monto acordado) */
export const BUDGET_PAYING: BudgetStatus[] = ["aceptado", "en_ejecucion", "finalizado"];

export const BUDGET_KINDS: Record<BudgetKind, { label: string; short: string }> = {
  membretado: { label: "Con hoja membretada", short: "Membretado" },
  manual: { label: "Manual con costo fijo", short: "Manual" },
};

export function BudgetStatusBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", BUDGET_STATUS[status].className, className)}>
      {BUDGET_STATUS[status].label}
    </span>
  );
}
