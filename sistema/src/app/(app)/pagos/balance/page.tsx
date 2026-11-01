"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Lock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { BUDGET_PAYING } from "@/components/budgets/budget-status";
import { MONTHS } from "@/lib/constants";
import { useBudgets, usePayments, useSession } from "@/lib/data/hooks";
import { totalsByCurrency } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Budget, Payment } from "@/lib/types";

const asFees = (list: Budget[]) => list.map((b) => ({ amount: b.price, currency: b.currency }));
const accepted = (list: Budget[]) => list.filter((b) => BUDGET_PAYING.includes(b.status));

/** Montos por moneda, cada una en su renglón (así la tabla entra en una hoja al imprimir) */
function Totals({ items }: { items: Parameters<typeof totalsByCurrency>[0] }) {
  const parts = totalsByCurrency(items).split(" + ").filter(Boolean);
  return parts.length ? parts.map((p) => <span key={p} className="block">{p}</span>) : "—";
}

/** Una fila del balance: los presupuestos de ese período (por su fecha) y lo cobrado (por la fecha del pago) */
function Row({ label, budgets, payments }: { label: string; budgets: Budget[]; payments: Payment[] }) {
  const yes = accepted(budgets);
  return (
    <>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right tabular-nums">{budgets.length}</TableCell>
      <TableCell className="text-right tabular-nums">{yes.length}</TableCell>
      <TableCell className="text-right tabular-nums"><Totals items={asFees(yes)} /></TableCell>
      <TableCell className="text-right font-medium tabular-nums"><Totals items={payments} /></TableCell>
    </>
  );
}

/** Balance por mes: cuántos presupuestos se hicieron y cuánto se ganó */
export default function BudgetBalancePage() {
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const budgets = useBudgets(allowed);
  const payments = usePayments(allowed);
  const [year, setYear] = useState(() => String(new Date().getFullYear()));

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="El balance es solo para administradores." />;

  const allBudgets = budgets.data ?? [];
  const allPayments = payments.data ?? [];
  const years = [...new Set([year, ...allBudgets.map((b) => b.issued_on.slice(0, 4)), ...allPayments.map((p) => p.paid_on.slice(0, 4))])].sort().reverse();
  const ofYear = allBudgets.filter((b) => b.issued_on.startsWith(year));
  const paidInYear = allPayments.filter((p) => p.paid_on.startsWith(year));

  return (
    <>
      <Link href="/pagos" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="size-3.5" /> Presupuestos
      </Link>
      <PageHeader
        title={`Balance ${year}`}
        description="Cuántos presupuestos se hicieron y cuánto se ganó en cada mes."
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <SimpleSelect value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} className="w-28" aria-label="Año del balance" />
            <Button variant="outline" onClick={() => window.print()}><Printer /> Imprimir o guardar PDF</Button>
          </div>
        }
      />

      {budgets.isLoading || payments.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando balance…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">Presupuestos hechos</TableHead>
                <TableHead className="text-right">Aceptados</TableHead>
                <TableHead className="text-right">Honorarios aceptados</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((name, i) => {
                const prefix = `${year}-${String(i + 1).padStart(2, "0")}`;
                return (
                  <TableRow key={name} data-month={prefix}>
                    <Row
                      label={name}
                      budgets={ofYear.filter((b) => b.issued_on.startsWith(prefix))}
                      payments={paidInYear.filter((p) => p.paid_on.startsWith(prefix))}
                    />
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow data-month="total">
                <Row label={`Total ${year}`} budgets={ofYear} payments={paidInYear} />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        “Cobrado” es la suma de los pagos registrados en ese mes. “Honorarios aceptados” son los presupuestos de ese mes
        que están Aceptados, En ejecución o Finalizados. Pesos y dólares no se mezclan.
      </p>
    </>
  );
}
