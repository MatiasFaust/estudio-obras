"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Calculator, ChevronDown, Download, FileText, Lock, NotebookPen, Pencil, Plus, Search, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SimpleSelect } from "@/components/common/simple-select";
import { downloadBudgetPdf } from "@/components/budgets/budget-pdf";
import { BUDGET_KINDS, BUDGET_STATUS, BUDGET_STATUS_OPTIONS, BudgetStatusBadge } from "@/components/budgets/budget-status";
import { CalculatorDialog } from "@/components/budgets/calculator-dialog";
import { money } from "@/components/budgets/budget-text";
import { ManualBudgetForm } from "@/components/budgets/manual-budget-form";
import { summarize } from "@/components/payments/summary";
import { useAction, useBudgets, useBudgetSettings, useClients, useFinances, usePayments, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { formatDate, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Budget, BudgetStatus } from "@/lib/types";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(BUDGET_STATUS_OPTIONS);
const KIND_FILTER = [{ value: "", label: "Todos los tipos" }].concat(
  Object.entries(BUDGET_KINDS).map(([value, k]) => ({ value, label: k.label })),
);
// Estados en los que el presupuesto ya se está cobrando (su precio es el monto acordado de la obra)
const PAYING: BudgetStatus[] = ["aceptado", "en_ejecucion", "finalizado"];

/** Presupuestos: lista de todos los presupuestos del estudio y creador */
export default function BudgetsPage() {
  const router = useRouter();
  const repo = useRepo();
  const { run } = useAction();
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const budgets = useBudgets(allowed);
  const settings = useBudgetSettings(allowed);
  const projects = useProjects();
  const clients = useClients();
  const finances = useFinances(allowed);
  const payments = usePayments(allowed);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  // Ventana de "+ Presupuesto": primero se elige el tipo; el manual se completa ahí mismo
  const [creating, setCreating] = useState<null | "choose" | "manual">(null);
  const [busy, setBusy] = useState<string | null>(null);
  // La calculadora se abre sola al entrar a Presupuestos
  const [calcOpen, setCalcOpen] = useState(true);

  const projectById = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);

  if (!allowed) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  }

  const all = budgets.data ?? [];
  const rows = all.filter((b) => {
    const p = b.project_id ? projectById.get(b.project_id) : undefined;
    return (!status || b.status === status) && (!kind || b.kind === kind)
      && matches(query, b.number, b.client_name, b.padron, b.service, b.address, p?.name, p?.code);
  });

  async function download(b: Budget) {
    if (!settings.data) return;
    setBusy(b.id);
    try {
      await downloadBudgetPdf(b, settings.data);
    } finally {
      setBusy(null);
    }
  }

  // Avance de pago: lo cobrado en la obra sobre el monto acordado (antes de aceptarlo, 0 %)
  function paidPercent(b: Budget) {
    if (!b.project_id || !PAYING.includes(b.status)) return 0;
    const finance = finances.data?.find((f) => f.project_id === b.project_id);
    const own = (payments.data ?? []).filter((p) => p.project_id === b.project_id);
    return summarize(finance, own).percent ?? 0;
  }

  const changeStatus = (b: Budget, next: BudgetStatus) =>
    next !== b.status && run(() => repo.updateBudget(b.id, { status: next }), `${b.number ? `Presupuesto ${b.number}` : "Presupuesto"}: ${BUDGET_STATUS[next].label}`);

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description={`${rows.length} de ${all.length} presupuestos`}
        actions={
          <>
            <Button variant="outline" onClick={() => setCalcOpen(true)}><Calculator /> Calculadora</Button>
            <Link href="/pagos/plantilla" className={buttonVariants({ variant: "outline" })}><Settings2 /> Plantilla</Link>
            <Button onClick={() => setCreating("choose")}><Plus /> Presupuesto</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número, cliente, padrón…" className="pl-8" aria-label="Buscar presupuestos" />
        </div>
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_FILTER} placeholder="Todos los estados" className="w-44" aria-label="Filtrar por estado" />
        <SimpleSelect value={kind} onChange={setKind} options={KIND_FILTER} placeholder="Todos los tipos" className="w-52" aria-label="Filtrar por tipo" />
      </div>

      {budgets.isLoading || projects.isLoading || finances.isLoading || payments.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando presupuestos…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={all.length ? "Ningún presupuesto coincide con la búsqueda" : "Todavía no hay presupuestos"}
          action={!all.length && <Button onClick={() => setCreating("choose")}><Plus /> Presupuesto</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N.º</TableHead>
                <TableHead className="hidden sm:table-cell">Padrón</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Servicio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden w-40 sm:table-cell">Avance</TableHead>
                <TableHead className="text-right">Honorarios</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/pagos/${b.id}`} className="font-medium hover:underline">{b.number || "Sin número"}</Link>
                    <span className="block text-xs text-muted-foreground">{BUDGET_KINDS[b.kind].short} · {formatDate(b.issued_on)}</span>
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{b.padron || "—"}</TableCell>
                  <TableCell className="max-w-52">
                    <span className="block truncate">{b.client_name || "—"}</span>
                    {b.project_id && projectById.get(b.project_id) && (
                      <span className="block truncate text-xs text-muted-foreground">{projectById.get(b.project_id)!.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">{b.service || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" className="inline-flex items-center gap-0.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Cambiar estado de ${b.number || "presupuesto"}`}>
                            <BudgetStatusBadge status={b.status} />
                            <ChevronDown className="size-3 text-muted-foreground" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="start" className="w-44">
                        <DropdownMenuRadioGroup value={b.status} onValueChange={(v) => changeStatus(b, v as BudgetStatus)}>
                          {BUDGET_STATUS_OPTIONS.map((o) => (
                            <DropdownMenuRadioItem key={o.value} value={o.value}>{o.label}</DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <PaymentProgress budget={b} percent={paidPercent(b)} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{b.price !== null ? money(b.price, b.currency) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {b.kind === "membretado" && (
                        <Button size="icon-sm" variant="outline" disabled={busy === b.id || !settings.data} onClick={() => download(b)} aria-label={`Descargar PDF de ${b.number || "presupuesto"}`} title="Descargar PDF">
                          <Download />
                        </Button>
                      )}
                      <Link href={`/pagos/${b.id}`} className={buttonVariants({ size: "icon-sm", variant: "ghost" })} aria-label={`Editar ${b.number || "presupuesto"}`} title="Editar">
                        <Pencil />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CalculatorDialog
        open={calcOpen}
        onOpenChange={setCalcOpen}
        settings={settings.data}
        projects={projects.data ?? []}
        clients={clients.data ?? []}
      />

      <Dialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className={creating === "manual" ? "max-h-[92dvh] overflow-y-auto sm:max-w-lg" : "sm:max-w-lg"}>
          {creating === "manual" ? (
            <>
              <DialogHeader>
                <button type="button" onClick={() => setCreating("choose")} className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="size-3.5" /> Volver
                </button>
                <DialogTitle>Presupuesto manual con costo fijo</DialogTitle>
                <DialogDescription>Para registrar un importe ya acordado. No genera PDF.</DialogDescription>
              </DialogHeader>
              {settings.data && (
                <ManualBudgetForm
                  settings={settings.data}
                  projects={projects.data ?? []}
                  clients={clients.data ?? []}
                  onSaved={() => setCreating(null)}
                  onCancel={() => setCreating(null)}
                />
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Nuevo presupuesto</DialogTitle>
                <DialogDescription>¿Qué tipo de presupuesto querés hacer?</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <ChoiceButton
                  icon={FileText}
                  title="Presupuesto con hoja membretada"
                  description="Con la hoja del estudio: descripción del trabajo, honorarios y condiciones de pago. Se puede ver, descargar en PDF e imprimir."
                  onClick={() => {
                    setCreating(null);
                    router.push("/pagos/nuevo");
                  }}
                />
                <ChoiceButton
                  icon={NotebookPen}
                  title="Presupuesto manual con costo fijo"
                  description="Cliente, servicio y honorarios ya acordados. Queda registrado en la tabla, sin PDF."
                  onClick={() => setCreating("manual")}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Barrita de cuánto se cobró; lleva a la pestaña de pagos de la obra, donde se registran */
function PaymentProgress({ budget: b, percent }: { budget: Budget; percent: number }) {
  if (!b.project_id || b.status === "rechazado") {
    return (
      <span className="text-muted-foreground" title={b.project_id ? undefined : "Los pagos se registran en la obra: vinculá el presupuesto a una obra para ver el avance."}>
        —
      </span>
    );
  }
  return (
    <Link
      href={`/obras/${b.project_id}?tab=pagos`}
      className="block w-36 rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Pagos de ${b.number || "presupuesto"}: ${percent}% cobrado`}
      title="Ver y registrar los pagos de la obra"
    >
      <ProgressBar value={percent} />
    </Link>
  );
}

function ChoiceButton({
  icon: Icon, title, description, onClick,
}: { icon: React.ElementType; title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Icon className="size-4.5" /></span>
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
