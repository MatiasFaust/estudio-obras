"use client";

import Link from "next/link";
import { useState } from "react";
import { Banknote, Lock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusDot } from "@/components/common/status-badge";
import { summarize } from "@/components/payments/summary";
import { useClients, useFinances, usePayments, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Currency } from "@/lib/types";

export default function PaymentsPage() {
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const projects = useProjects();
  const clients = useClients();
  const finances = useFinances(allowed);
  const payments = usePayments(allowed);
  const [onlyPending, setOnlyPending] = useState(false);

  if (!allowed) {
    return <EmptyState icon={Lock} title="Sin permiso" description="La información de pagos es solo para administradores." />;
  }

  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const rows = (projects.data ?? [])
    .map((p) => {
      const own = (payments.data ?? []).filter((x) => x.project_id === p.id);
      const finance = finances.data?.find((f) => f.project_id === p.id);
      return { project: p, summary: summarize(finance, own), hasData: !!finance || own.length > 0 };
    })
    .filter((r) => r.hasData || r.project.status !== "archivada")
    .filter((r) => !onlyPending || (r.summary.balance ?? 0) > 0)
    .sort((a, b) => (b.summary.balance ?? -1) - (a.summary.balance ?? -1));

  const totals = (["USD", "UYU"] as Currency[]).map((cur) => {
    const list = rows.filter((r) => r.summary.currency === cur && r.hasData);
    return {
      cur,
      agreed: list.reduce((a, r) => a + (r.summary.agreed ?? 0), 0),
      paid: list.reduce((a, r) => a + r.summary.paid, 0),
      balance: list.reduce((a, r) => a + Math.max(0, r.summary.balance ?? 0), 0),
      n: list.length,
    };
  }).filter((t) => t.n > 0);

  return (
    <>
      <PageHeader title="Pagos" description="Avance de pago de cada obra: monto acordado, pagado y saldo pendiente." />

      {totals.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.map((t) => (
            <div key={t.cur} className="rounded-xl border bg-card p-3.5">
              <div className="text-xs text-muted-foreground">Por cobrar en {t.cur === "USD" ? "dólares" : "pesos"}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">{formatMoney(t.balance, t.cur)}</div>
              <div className="text-xs text-muted-foreground">Cobrado {formatMoney(t.paid, t.cur)} de {formatMoney(t.agreed, t.cur)}</div>
            </div>
          ))}
        </div>
      )}

      <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={onlyPending} onCheckedChange={setOnlyPending} /> Solo obras con saldo pendiente
      </label>

      {projects.isLoading || finances.isLoading || payments.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Banknote} title="No hay obras con pagos pendientes" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Acordado</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="hidden w-40 md:table-cell">Avance de pago</TableHead>
                <TableHead className="hidden lg:table-cell">Último pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ project: p, summary: s }) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-64">
                    <Link href={`/obras/${p.id}?tab=pagos`} className="block hover:underline">
                      <span className="flex items-center gap-2 truncate font-medium"><StatusDot status={p.status} />{p.name}</span>
                      <span className="block truncate pl-4 text-xs text-muted-foreground">{p.client_id ? clientName.get(p.client_id) : "Sin cliente"}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{formatMoney(s.agreed, s.currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{s.count ? formatMoney(s.paid, s.currency) : "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">{formatMoney(s.balance, s.currency)}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.percent !== null ? <ProgressBar value={s.percent} /> : <span className="text-xs text-muted-foreground">Sin monto acordado</span>}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{s.lastPaidOn ? formatDate(s.lastPaidOn) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            {totals.length > 0 && (
              <TableFooter>
                {totals.map((t) => (
                  <TableRow key={t.cur}>
                    <TableCell className="font-medium">Total {t.cur}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(t.agreed, t.cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(t.paid, t.cur)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatMoney(t.balance, t.cur)}</TableCell>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="hidden lg:table-cell" />
                  </TableRow>
                ))}
              </TableFooter>
            )}
          </Table>
        </div>
      )}
    </>
  );
}
