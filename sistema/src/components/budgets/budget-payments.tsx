"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentsPanel } from "@/components/payments/payments-panel";
import { usePayments } from "@/lib/data/hooks";
import type { Budget, Project } from "@/lib/types";

/** Pagos de un presupuesto: con obra se registran en la obra; sin obra, acá mismo */
export function BudgetPayments({ budget, project }: { budget: Budget; project?: Project }) {
  const ref = useRef<HTMLElement>(null);
  // Desde la barrita de "Avance" de la tabla se llega con #pagos
  useEffect(() => {
    if (window.location.hash === "#pagos") ref.current?.scrollIntoView({ block: "start" });
  }, []);

  return (
    <section id="pagos" ref={ref} className="grid scroll-mt-20 gap-3 pt-2">
      <h2 className="font-semibold tracking-tight">Pagos</h2>
      {budget.project_id ? (
        <Card size="sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              Está vinculado a {project ? `la obra ${project.name}` : "una obra"}: los pagos se registran en la obra.
            </span>
            <Link href={`/obras/${budget.project_id}?tab=pagos`} className={buttonVariants({ variant: "outline", size: "sm" })}>Ver pagos de la obra</Link>
          </CardContent>
        </Card>
      ) : (
        <PaymentsPanel budget={budget} />
      )}
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
