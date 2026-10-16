"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { PropertyStatusDot } from "@/components/dev/property-status";
import { PROPERTY_STATUS, PROPERTY_STATUS_ORDER } from "@/lib/constants";
import { useDevLeases, useDevPayments, useDevProperties, useDevTenants, useSession } from "@/lib/data/hooks";
import { daysToEnd, isLeaseActive, leaseBalance, leaseLastDay } from "@/lib/dev";
import { formatDate, formatMoney } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Currency } from "@/lib/types";

export default function DevDashboard() {
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const properties = useDevProperties();
  const tenants = useDevTenants(admin);
  const leases = useDevLeases(admin);
  const payments = useDevPayments(admin);

  const list = (properties.data ?? []).filter((p) => !p.archived_at);
  const count = (s: string) => list.filter((p) => p.status === s).length;
  const propName = new Map(list.map((p) => [p.id, p.name]));
  const tenantName = new Map((tenants.data ?? []).map((t) => [t.id, t.name]));

  const active = (leases.data ?? []).filter((l) => isLeaseActive(l));
  const debts = active
    .map((l) => ({ lease: l, ...leaseBalance(l, payments.data ?? []) }))
    .filter((d) => d.owed > 0)
    .sort((a, b) => b.monthsOwed - a.monthsOwed);
  const expiring = active
    .map((l) => ({ lease: l, days: daysToEnd(l) }))
    .filter((x): x is { lease: typeof x.lease; days: number } => x.days !== null && x.days <= 60)
    .sort((a, b) => a.days - b.days);
  const byCurrency = (cur: Currency, rows: { amount: number; cur: Currency }[]) =>
    rows.filter((r) => r.cur === cur).reduce((a, r) => a + r.amount, 0);
  const monthly = active.map((l) => ({ amount: l.rent_amount, cur: l.currency }));
  const owed = debts.map((d) => ({ amount: d.owed, cur: d.lease.currency }));

  return (
    <>
      <PageHeader title="Estudio de desarrollo" description="Casas y terrenos propios en alquiler" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PROPERTY_STATUS_ORDER.map((s) => (
          <Link key={s} href={`/desarrollo/propiedades?estado=${s}`} className="rounded-xl border bg-card p-3.5 transition-colors hover:border-foreground/20">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><PropertyStatusDot status={s} />{PROPERTY_STATUS[s].label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{properties.isLoading ? "…" : count(s)}</div>
          </Link>
        ))}
      </div>

      {admin && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-3.5">
              <div className="text-xs text-muted-foreground">Alquileres por mes ({active.length} contratos vigentes)</div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-2xl font-semibold tabular-nums tracking-tight">
                {(["UYU", "USD"] as Currency[]).filter((c) => byCurrency(c, monthly) > 0).map((c) => (
                  <span key={c}>{formatMoney(byCurrency(c, monthly), c)}</span>
                ))}
                {!monthly.length && <span>—</span>}
              </div>
            </div>
            <Link href="/desarrollo/cobros" className="rounded-xl border bg-card p-3.5 transition-colors hover:border-foreground/20">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                Alquileres atrasados <span className="flex items-center gap-1">Ver cobros <ArrowRight className="size-3" /></span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-2xl font-semibold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
                {(["UYU", "USD"] as Currency[]).filter((c) => byCurrency(c, owed) > 0).map((c) => (
                  <span key={c}>{formatMoney(byCurrency(c, owed), c)}</span>
                ))}
                {!owed.length && <span className="text-foreground">Al día</span>}
              </div>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card size="sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /> Deben alquiler</CardTitle></CardHeader>
              <CardContent>
                {debts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todos los inquilinos están al día.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {debts.map(({ lease: l, owed: o, monthsOwed }) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/desarrollo/propiedades/${l.property_id}`} className="min-w-0 hover:underline">
                          <span className="block truncate font-medium">{propName.get(l.property_id) ?? "—"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{tenantName.get(l.tenant_id) ?? "—"}</span>
                        </Link>
                        <span className="text-right">
                          <span className="block font-medium tabular-nums">{formatMoney(o, l.currency)}</span>
                          <span className="block text-xs text-muted-foreground">{monthsOwed === 1 ? "1 mes" : `${monthsOwed} meses`}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" /> Contratos que vencen pronto</CardTitle></CardHeader>
              <CardContent>
                {expiring.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ningún contrato vence en los próximos 60 días.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {expiring.map(({ lease: l, days }) => (
                      <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href={`/desarrollo/propiedades/${l.property_id}`} className="min-w-0 hover:underline">
                          <span className="block truncate font-medium">{propName.get(l.property_id) ?? "—"}</span>
                          <span className="block truncate text-xs text-muted-foreground">{tenantName.get(l.tenant_id) ?? "—"}</span>
                        </Link>
                        <span className="text-right text-xs">
                          <span className="block font-medium">{formatDate(leaseLastDay(l))}</span>
                          <span className="block text-muted-foreground">{days === 0 ? "vence hoy" : `en ${days} días`}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
