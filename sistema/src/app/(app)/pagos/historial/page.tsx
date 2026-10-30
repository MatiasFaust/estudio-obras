"use client";

import Link from "next/link";
import { format, subMonths } from "date-fns";
import { useMemo, useState } from "react";
import { ArrowLeft, Banknote, Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { BUDGET_PAYING } from "@/components/budgets/budget-status";
import { PAYMENT_METHODS } from "@/lib/constants";
import { useBudgets, useClients, usePayments, useProfiles, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, formatMoney, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Budget, Currency, Payment } from "@/lib/types";

const PERIODS = [
  { value: "", label: "Todas las fechas" },
  { value: "mes", label: "Este mes" },
  { value: "mes-anterior", label: "El mes pasado" },
  { value: "anio", label: "Este año" },
];

/** Prefijo de fecha ("2026-10", "2026") del período elegido, en hora local */
function periodPrefix(period: string): string {
  const now = new Date();
  if (period === "mes") return format(now, "yyyy-MM");
  if (period === "mes-anterior") return format(subMonths(now, 1), "yyyy-MM");
  if (period === "anio") return format(now, "yyyy");
  return "";
}

/** De una obra con varios presupuestos, el que se está cobrando (aceptado o en curso), o el último */
function mainBudget(list: Budget[]): Budget | undefined {
  const live = list.filter((b) => b.status !== "rechazado");
  return live.find((b) => BUDGET_PAYING.includes(b.status)) ?? live[0] ?? list[0];
}

/** Historial de pagos: todos los cobros de los presupuestos, quién pagó y cuánto */
export default function PaymentsHistoryPage() {
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const budgets = useBudgets(allowed);
  const payments = usePayments(allowed);
  const projects = useProjects();
  const clients = useClients();
  const profiles = useProfiles();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("");

  const rows = useMemo(() => {
    const budgetById = new Map((budgets.data ?? []).map((b) => [b.id, b]));
    const projectById = new Map((projects.data ?? []).map((p) => [p.id, p]));
    const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
    const userName = new Map((profiles.data ?? []).map((u) => [u.id, u.full_name]));
    // La lista ya viene ordenada por fecha (la más nueva primero)
    const byProject = new Map<string, Budget[]>();
    for (const b of budgets.data ?? []) {
      if (b.project_id) byProject.set(b.project_id, [...(byProject.get(b.project_id) ?? []), b]);
    }
    return (payments.data ?? [])
      .map((p: Payment) => {
        const budget = p.budget_id ? budgetById.get(p.budget_id) : p.project_id ? mainBudget(byProject.get(p.project_id) ?? []) : undefined;
        const project = p.project_id ? projectById.get(p.project_id) : undefined;
        const client = budget?.client_name || (project?.client_id ? clientName.get(project.client_id) : "") || "";
        return { pay: p, budget, project, client, by: p.created_by ? userName.get(p.created_by) ?? "" : "" };
      })
      .sort((a, b) => b.pay.paid_on.localeCompare(a.pay.paid_on) || b.pay.created_at.localeCompare(a.pay.created_at));
  }, [budgets.data, payments.data, projects.data, clients.data, profiles.data]);

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="El historial de pagos es solo para administradores." />;

  const prefix = periodPrefix(period);
  const shown = rows.filter((r) => r.pay.paid_on.startsWith(prefix)
    && matches(query, r.client, r.budget?.number, r.budget?.service, r.project?.name, r.pay.concept, r.pay.receipt, r.pay.notes));
  // Total cobrado en cada moneda (los pagos en dólares y en pesos no se mezclan)
  const totals = (["UYU", "USD"] as Currency[])
    .map((cur) => ({ cur, sum: shown.filter((r) => r.pay.currency === cur).reduce((a, r) => a + r.pay.amount, 0) }))
    .filter((t) => t.sum > 0);

  return (
    <>
      <Link href="/pagos" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Presupuestos
      </Link>
      <PageHeader
        title="Historial de pagos"
        description={`${shown.length} ${shown.length === 1 ? "pago" : "pagos"}${totals.length ? ` · Cobrado: ${totals.map((t) => formatMoney(t.sum, t.cur)).join(" + ")}` : ""}`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cliente, presupuesto, concepto…" className="pl-8" aria-label="Buscar pagos" />
        </div>
        <SimpleSelect value={period} onChange={setPeriod} options={PERIODS} placeholder="Todas las fechas" className="w-44" aria-label="Filtrar por fecha" />
      </div>

      {budgets.isLoading || payments.isLoading || projects.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando pagos…</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title={rows.length ? "Ningún pago coincide con la búsqueda" : "Todavía no hay pagos registrados"}
          description={rows.length ? undefined : "Se registran desde Presupuestos, con el botón “Registrar pago”."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Presupuesto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Concepto</TableHead>
                <TableHead className="hidden lg:table-cell">Medio</TableHead>
                <TableHead className="hidden xl:table-cell">Registró</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map(({ pay: p, budget: b, project, client, by }) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(p.paid_on)}</TableCell>
                  <TableCell className="max-w-44">
                    {b ? (
                      <Link href={`/pagos/${b.id}#pagos`} className="font-medium hover:underline">{b.number || "Sin número"}</Link>
                    ) : project ? (
                      <Link href={`/obras/${project.id}?tab=pagos`} className="font-medium hover:underline">Obra</Link>
                    ) : "—"}
                    {(project || b?.service) && (
                      <span className="block truncate text-xs text-muted-foreground">{project?.name ?? b?.service}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{client || "—"}</TableCell>
                  <TableCell className="hidden max-w-64 md:table-cell">
                    <span className="block truncate">{p.concept}</span>
                    {(p.receipt || p.notes) && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {p.receipt && `Comprobante ${p.receipt}`}{p.receipt && p.notes && " · "}{p.notes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{PAYMENT_METHODS[p.method]}</TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{by || "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                    {p.exchange_rate && <span className="block text-xs text-muted-foreground">cot. {p.exchange_rate}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
