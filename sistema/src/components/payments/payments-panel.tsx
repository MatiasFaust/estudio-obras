"use client";

import { useState } from "react";
import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ProgressBar } from "@/components/common/progress-bar";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useAction, useFinances, usePayments, useRepo } from "@/lib/data/hooks";
import { formatDate, formatMoney } from "@/lib/format";
import type { Payment, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FinanceDialog, PaymentDialog } from "./payment-dialogs";
import { summarize } from "./summary";

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums tracking-tight", tone)}>{value}</div>
    </div>
  );
}

/** Avance de pago de una obra (solo administradores) */
export function PaymentsPanel({ project }: { project: Project }) {
  const repo = useRepo();
  const { run } = useAction();
  const finances = useFinances(true);
  const payments = usePayments(true);
  const [editingFinance, setEditingFinance] = useState(false);
  const [editing, setEditing] = useState<{ payment: Payment | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);

  const finance = finances.data?.find((f) => f.project_id === project.id);
  const own = (payments.data ?? []).filter((p) => p.project_id === project.id);
  const s = summarize(finance, own);

  if (finances.isLoading || payments.isLoading) return <p className="text-sm text-muted-foreground">Cargando pagos…</p>;

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <Figure label="Monto acordado" value={formatMoney(s.agreed, s.currency)} />
            <Figure label="Pagado" value={formatMoney(s.paid, s.currency)} tone="text-emerald-700 dark:text-emerald-400" />
            <Figure label="Saldo pendiente" value={formatMoney(s.balance, s.currency)} tone={s.balance && s.balance > 0 ? "text-amber-700 dark:text-amber-400" : undefined} />
            <Figure label="Último pago" value={s.lastPaidOn ? formatDate(s.lastPaidOn) : "—"} />
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditingFinance(true)}>
            <Pencil /> {finance ? "Editar monto acordado" : "Fijar monto acordado"}
          </Button>
        </div>
        {s.percent !== null ? (
          <div className="mt-4">
            <div className="mb-1 text-xs text-muted-foreground">Avance de pago</div>
            <ProgressBar value={s.percent} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Fijá el monto acordado para ver el porcentaje pagado y el saldo.</p>
        )}
        {finance?.notes && <p className="mt-3 text-xs text-muted-foreground">{finance.notes}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Pagos recibidos ({own.length})</h2>
        <Button size="sm" onClick={() => setEditing({ payment: null, key: Date.now() })}><Plus /> Registrar pago</Button>
      </div>

      {own.length === 0 ? (
        <EmptyState icon={Banknote} title="Todavía no hay pagos registrados" description="Registrá cada adelanto o pago del cliente para seguir el saldo." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="hidden md:table-cell">Medio</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {own.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(p.paid_on)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{p.concept}</div>
                    {(p.receipt || p.notes) && (
                      <div className="text-xs text-muted-foreground">
                        {p.receipt && `Comprobante ${p.receipt}`}{p.receipt && p.notes && " · "}{p.notes}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{PAYMENT_METHODS[p.method]}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <div className="font-medium">{formatMoney(p.amount, p.currency)}</div>
                    {p.currency !== s.currency && (
                      <div className="text-xs text-muted-foreground">
                        = {formatMoney(p.amount_contract, s.currency)} (cot. {p.exchange_rate})
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label="Editar pago" onClick={() => setEditing({ payment: p, key: Date.now() })}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Eliminar pago" onClick={() => setDeleting(p)}><Trash2 /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editingFinance && <FinanceDialog projectId={project.id} finance={finance} onClose={() => setEditingFinance(false)} />}
      {editing && (
        <PaymentDialog key={editing.key} projectId={project.id} contractCurrency={s.currency} payment={editing.payment} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar el pago?"
        description={deleting ? `Se eliminará el pago de ${formatMoney(deleting.amount, deleting.currency)} del ${formatDate(deleting.paid_on)}.` : ""}
        onConfirm={() => run(() => repo.deletePayment(deleting!.id), "Pago eliminado")}
      />
    </div>
  );
}
