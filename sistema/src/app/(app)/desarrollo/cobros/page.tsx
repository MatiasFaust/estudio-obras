"use client";

import Link from "next/link";
import { useState } from "react";
import { FileSignature, KeyRound, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { LeaseDialog, RentPaymentDialog } from "@/components/dev/dialogs";
import { useDevLeases, useDevPayments, useDevProperties, useDevTenants, useSession } from "@/lib/data/hooks";
import { daysToEnd, isLeaseActive, leaseBalance, leaseLastDay } from "@/lib/dev";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { DevLease } from "@/lib/types";

export default function RentsPage() {
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const properties = useDevProperties();
  const tenants = useDevTenants(admin);
  const leases = useDevLeases(admin);
  const payments = useDevPayments(admin);
  const [onlyOwed, setOnlyOwed] = useState(false);
  const [paying, setPaying] = useState<DevLease | null>(null);
  const [creating, setCreating] = useState(false);

  if (!admin) return <EmptyState icon={Lock} title="Sin permiso" description="Los alquileres y cobros son solo para administradores." />;

  const propName = new Map((properties.data ?? []).map((p) => [p.id, p.name]));
  const tenantName = new Map((tenants.data ?? []).map((t) => [t.id, t.name]));
  const rows = (leases.data ?? [])
    .filter((l) => isLeaseActive(l))
    .map((l) => ({ l, ...leaseBalance(l, payments.data ?? []), days: daysToEnd(l) }))
    .filter((r) => !onlyOwed || r.owed > 0)
    .sort((a, b) => b.monthsOwed - a.monthsOwed || (propName.get(a.l.property_id) ?? "").localeCompare(propName.get(b.l.property_id) ?? ""));

  return (
    <>
      <PageHeader
        title="Alquileres y cobros"
        description="Contratos vigentes, quién está al día y quién debe"
        actions={<Button variant="outline" onClick={() => setCreating(true)}><FileSignature /> Nuevo contrato</Button>}
      />
      <label className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={onlyOwed} onCheckedChange={setOnlyOwed} /> Solo los que deben
      </label>

      {leases.isLoading || payments.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={KeyRound} title={onlyOwed ? "Nadie debe alquiler" : "No hay contratos vigentes"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="text-right">Alquiler</TableHead>
                <TableHead className="text-right">Debe</TableHead>
                <TableHead className="hidden md:table-cell">Último cobro</TableHead>
                <TableHead className="hidden lg:table-cell">Vence el contrato</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ l, owed, monthsOwed, lastPaidOn, days }) => (
                <TableRow key={l.id}>
                  <TableCell className="max-w-64">
                    <Link href={`/desarrollo/propiedades/${l.property_id}`} className="block hover:underline">
                      <span className="block truncate font-medium">{propName.get(l.property_id) ?? "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground">{tenantName.get(l.tenant_id) ?? "—"}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{formatMoney(l.rent_amount, l.currency)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {owed > 0
                      ? <span className="font-medium text-amber-700 dark:text-amber-400">{formatMoney(owed, l.currency)}<span className="block text-xs font-normal text-muted-foreground">{monthsOwed === 1 ? "1 mes" : `${monthsOwed} meses`}</span></span>
                      : <span className="text-muted-foreground">Al día</span>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(lastPaidOn)}</TableCell>
                  <TableCell className={days !== null && days <= 60 ? "hidden font-medium text-amber-700 lg:table-cell dark:text-amber-400" : "hidden text-muted-foreground lg:table-cell"}>
                    {leaseLastDay(l) ? formatDate(leaseLastDay(l)) : "Sin fecha"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant={owed > 0 ? "default" : "outline"} onClick={() => setPaying(l)}><Plus /> Cobro</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {paying && <RentPaymentDialog lease={paying} payments={payments.data ?? []} onClose={() => setPaying(null)} />}
      {creating && (
        <LeaseDialog properties={properties.data ?? []} tenants={tenants.data ?? []} onClose={() => setCreating(false)} />
      )}
    </>
  );
}
