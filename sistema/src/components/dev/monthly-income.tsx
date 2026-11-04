"use client";

import { isLeaseActive } from "@/lib/dev";
import { totalsByCurrency } from "@/lib/format";
import type { DevLease } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lo que se gana por mes: la suma de los alquileres de los contratos vigentes, sin mezclar monedas */
export function MonthlyIncome({ leases, className }: { leases: DevLease[]; className?: string }) {
  const active = leases.filter((l) => isLeaseActive(l));
  const totals = totalsByCurrency(active.map((l) => ({ amount: l.rent_amount, currency: l.currency }))).split(" + ").filter(Boolean);
  return (
    <div className={cn("rounded-xl border bg-card p-3.5", className)} data-monthly-income>
      <div className="text-xs text-muted-foreground">
        Se gana por mes en total ({active.length === 1 ? "1 contrato vigente" : `${active.length} contratos vigentes`})
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-2xl font-semibold tabular-nums tracking-tight">
        {totals.length ? totals.map((t) => <span key={t}>{t}</span>) : <span>—</span>}
      </div>
    </div>
  );
}
