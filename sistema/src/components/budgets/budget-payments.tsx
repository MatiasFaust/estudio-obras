"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { PaymentsPanel } from "@/components/payments/payments-panel";
import { usePayments } from "@/lib/data/hooks";
import type { Budget, Project } from "@/lib/types";

/** Pagos de un presupuesto: se registran y se ven acá (con obra, son los mismos de la obra) */
export function BudgetPayments({ budget, project }: { budget: Budget; project?: Project }) {
  const ref = useRef<HTMLElement>(null);
  // Desde la barrita de "Avance" de la tabla se llega con #pagos
  useEffect(() => {
    if (window.location.hash === "#pagos") ref.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section id="pagos" ref={ref} className="grid scroll-mt-20 gap-3 pt-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold tracking-tight">Pagos</h2>
        {budget.project_id && (
          <p className="text-xs text-muted-foreground">
            Vinculado a {project ? (
              <Link href={`/obras/${budget.project_id}?tab=pagos`} className="underline-offset-2 hover:text-foreground hover:underline">la obra {project.name}</Link>
            ) : "una obra"}: los pagos también se ven ahí.
          </p>
        )}
      </div>
      <PaymentsPanel budget={budget} project={project} />
    </section>
  );
}

/** Aviso al borrar un presupuesto: si no tiene obra, sus pagos se borran con él */
export function useDeleteBudgetText(budgetId: string | undefined) {
  const payments = usePayments(!!budgetId);
  const n = budgetId ? (payments.data ?? []).filter((p) => p.budget_id === budgetId).length : 0;
  const extra = n === 1 ? "También se elimina su pago registrado. " : n > 1 ? `También se eliminan sus ${n} pagos registrados. ` : "";
  return `${extra}Esta acción no se puede deshacer.`;
}
