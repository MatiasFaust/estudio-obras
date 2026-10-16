import type { BudgetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const BUDGET_STATUS: Record<BudgetStatus, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  enviado: { label: "Enviado", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  aceptado: { label: "Aceptado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  rechazado: { label: "Rechazado", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export function BudgetStatusBadge({ status, className }: { status: BudgetStatus; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", BUDGET_STATUS[status].className, className)}>
      {BUDGET_STATUS[status].label}
    </span>
  );
}
