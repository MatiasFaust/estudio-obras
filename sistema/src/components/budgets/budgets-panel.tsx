"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FilePlus2, FileText, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { useBudgets, useBudgetSettings } from "@/lib/data/hooks";
import { formatDate } from "@/lib/format";
import type { Budget, Project } from "@/lib/types";
import { downloadBudgetPdf } from "./budget-pdf";
import { BUDGET_KINDS, BudgetStatusBadge } from "./budget-status";
import { money } from "./budget-text";

/** Presupuestos de la obra, debajo del avance de pagos (solo administradores) */
export function BudgetsPanel({ project }: { project: Project }) {
  const budgets = useBudgets(true);
  const settings = useBudgetSettings(true);
  const [busy, setBusy] = useState<string | null>(null);
  const own = (budgets.data ?? []).filter((b) => b.project_id === project.id);

  async function download(b: Budget) {
    if (!settings.data) return;
    setBusy(b.id);
    try {
      await downloadBudgetPdf(b, settings.data);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Presupuestos de esta obra ({own.length})</h2>
          <p className="text-xs text-muted-foreground">Al marcar uno como “Aceptado”, su precio pasa a ser el monto acordado de arriba. Se manejan desde Presupuestos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pagos/plantilla" className={buttonVariants({ variant: "ghost", size: "sm" })}><Settings2 /> Plantilla</Link>
          <Link href={`/pagos/nuevo?obra=${project.id}`} className={buttonVariants({ size: "sm" })}><FilePlus2 /> Nuevo presupuesto</Link>
        </div>
      </div>
      {budgets.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : own.length === 0 ? (
        <EmptyState icon={FileText} title="Todavía no hay presupuestos para esta obra" description="Armalo con “Nuevo presupuesto” y descargalo en PDF." />
      ) : (
        <Card size="sm">
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {own.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/pagos/${b.id}`} className="font-medium hover:underline">{b.number || "Sin número"}</Link>
                      <span className="block text-xs text-muted-foreground">{b.service || BUDGET_KINDS[b.kind].short}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(b.issued_on)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{b.price !== null ? money(b.price, b.currency) : "—"}</TableCell>
                    <TableCell><BudgetStatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right">
                      {b.kind === "membretado" && (
                        <Button size="sm" variant="outline" disabled={busy === b.id || !settings.data} onClick={() => download(b)}>
                          <Download /> PDF
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
