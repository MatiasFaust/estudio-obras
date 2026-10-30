"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Banknote, Calculator, ChevronDown, Copy, Download, FileText, FileUp, HardDriveUpload, History, Lock, MoreHorizontal, NotebookPen, Pencil, Plus, Search, Settings2, Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SimpleSelect } from "@/components/common/simple-select";
import { useDeleteBudgetText } from "@/components/budgets/budget-payments";
import { budgetFileName, budgetPdfBlob, downloadBudgetPdf } from "@/components/budgets/budget-pdf";
import { useSaveToDrive } from "@/components/budgets/drive-save";
import { BUDGET_KINDS, BUDGET_STATUS, BUDGET_STATUS_OPTIONS, BudgetStatusBadge } from "@/components/budgets/budget-status";
import { CalculatorDialog } from "@/components/budgets/calculator-dialog";
import { budgetCopy, money } from "@/components/budgets/budget-text";
import { ImportBudgetsDialog } from "@/components/budgets/import-budgets-dialog";
import { ManualBudgetForm } from "@/components/budgets/manual-budget-form";
import { budgetPaymentTarget, PaymentDialog, type PaymentChoice } from "@/components/payments/payment-dialogs";
import { budgetPayments } from "@/components/payments/summary";
import { useAction, useBudgets, useBudgetSettings, useClients, useFinances, usePayments, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { formatDate, formatMoney, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Budget, BudgetStatus } from "@/lib/types";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(BUDGET_STATUS_OPTIONS);
const KIND_FILTER = [{ value: "", label: "Todos los tipos" }].concat(
  Object.entries(BUDGET_KINDS).map(([value, k]) => ({ value, label: k.label })),
);

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
  // Ventana de "Registrar pago" (la clave la reinicia cada vez que se abre)
  const [paying, setPaying] = useState<number | null>(null);
  // La calculadora se abre sola al entrar a Presupuestos
  const [calcOpen, setCalcOpen] = useState(true);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState<Budget | null>(null);
  const deleteText = useDeleteBudgetText(deleting?.id);
  const drive = useSaveToDrive();

  const projectById = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);

  if (!allowed) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  }

  const all = budgets.data ?? [];
  const rows = all.filter((b) => {
    const p = b.project_id ? projectById.get(b.project_id) : undefined;
    return (!status || b.status === status) && (!kind || b.kind === kind)
      && matches(query, b.number, b.client_name, b.padron, b.service, b.address, b.responsible, p?.name, p?.code);
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

  async function saveToDrive(b: Budget) {
    const t = settings.data;
    if (t) await drive.save(budgetFileName(b), () => budgetPdfBlob(b, t));
  }

  // Avance de pago (ver budgetPayments): con obra, lo cobrado en la obra; sin obra, sus propios pagos
  const paymentsOf = (b: Budget) => budgetPayments(b, finances.data ?? [], payments.data ?? []);
  const paidPercent = (b: Budget) => paymentsOf(b).summary.percent ?? 0;

  // Presupuestos a los que se les puede registrar un pago (a dónde va: budgetPaymentTarget)
  const paymentChoices: PaymentChoice[] = all
    .filter((b) => b.status !== "rechazado")
    .map((b) => {
      const p = b.project_id ? projectById.get(b.project_id) : undefined;
      const { finance, hasAgreement, summary: s } = paymentsOf(b);
      return {
        value: b.id,
        label: `${b.number || "Sin número"} · ${b.client_name || "Sin cliente"}${p ? ` (${p.name})` : ""}`,
        hint: s.agreed !== null ? `${hasAgreement ? "Monto acordado de la obra" : "Honorarios"} ${formatMoney(s.agreed, s.currency)} · cobrado ${s.percent ?? 0} %` : undefined,
        target: budgetPaymentTarget(b, finance),
      };
    });

  const label = (b: Budget) => (b.number ? `Presupuesto ${b.number}` : "Presupuesto");

  /** Copia del presupuesto (sin número y pendiente), que se abre para completarla */
  async function duplicate(b: Budget) {
    const result: { copy?: Budget } = {};
    const ok = await run(async () => {
      result.copy = await repo.createBudget(budgetCopy(b));
    }, `${label(b)} duplicado: poné el número de la copia`);
    if (ok && result.copy) router.push(`/pagos/${result.copy.id}`);
  }

  const changeStatus = (b: Budget, next: BudgetStatus) =>
    next !== b.status && run(() => repo.updateBudget(b.id, { status: next }), `${label(b)}: ${BUDGET_STATUS[next].label}`);

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description={`${rows.length} de ${all.length} presupuestos`}
        actions={
          <>
            <Button variant="outline" onClick={() => setCalcOpen(true)}><Calculator /> Calculadora</Button>
            <Link href="/pagos/plantilla" className={buttonVariants({ variant: "outline" })}><Settings2 /> Plantilla</Link>
            <Link href="/pagos/historial" className={buttonVariants({ variant: "outline" })}><History /> Historial de pagos</Link>
            <Button variant="outline" disabled={!paymentChoices.length} onClick={() => setPaying(Date.now())}><Banknote /> Registrar pago</Button>
            <Button onClick={() => setCreating("choose")}><Plus /> Presupuesto</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número, cliente, padrón, responsable…" className="pl-8" aria-label="Buscar presupuestos" />
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
                <TableHead className="hidden w-28 sm:table-cell">Avance</TableHead>
                <TableHead className="hidden lg:table-cell">Responsables</TableHead>
                <TableHead className="text-right">Honorarios</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/pagos/${b.id}`} className="font-medium hover:underline">{b.number || "Sin número"}</Link>
                    <span className="block text-xs text-muted-foreground">{BUDGET_KINDS[b.kind].short}</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(b.issued_on)}</span>
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{b.padron || "—"}</TableCell>
                  <TableCell className="max-w-44">
                    <span className="block truncate">{b.client_name || "—"}</span>
                    {b.project_id && projectById.get(b.project_id) && (
                      <span className="block truncate text-xs text-muted-foreground">{projectById.get(b.project_id)!.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-32 truncate text-muted-foreground md:table-cell" title={b.service || undefined}>{b.service || "—"}</TableCell>
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
                  <TableCell className="hidden max-w-32 truncate text-muted-foreground lg:table-cell" title={b.responsible || undefined}>{b.responsible || "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{b.price !== null ? money(b.price, b.currency) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-0.5">
                      {b.kind === "membretado" && (
                        <Button size="icon-sm" variant="outline" disabled={busy === b.id || !settings.data} onClick={() => download(b)} aria-label={`Descargar PDF de ${b.number || "presupuesto"}`} title="Descargar PDF">
                          <Download />
                        </Button>
                      )}
                      <Link href={`/pagos/${b.id}`} className={buttonVariants({ size: "icon-sm", variant: "ghost" })} aria-label={`Editar ${b.number || "presupuesto"}`} title="Editar">
                        <Pencil />
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button size="icon-sm" variant="ghost" aria-label={`Más opciones de ${b.number || "presupuesto"}`} title="Duplicar o eliminar">
                              <MoreHorizontal />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          {b.kind === "membretado" && drive.supported && (
                            <DropdownMenuItem disabled={!settings.data} onClick={() => saveToDrive(b)}><HardDriveUpload /> Guardar en Drive</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => duplicate(b)}><Copy /> Duplicar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleting(b)}><Trash2 /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {paying && <PaymentDialog key={paying} choices={paymentChoices} onClose={() => setPaying(null)} />}
      {drive.dialog}
      <ImportBudgetsDialog open={importing} onOpenChange={setImporting} existing={all} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar ${deleting?.number ? `el presupuesto ${deleting.number}` : "el presupuesto"}?`}
        description={deleteText}
        onConfirm={() => run(() => repo.deleteBudget(deleting!.id), "Presupuesto eliminado")}
      />

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
                <ChoiceButton
                  icon={FileUp}
                  title="Subir presupuestos en PDF"
                  description="Los que ya tenés en la compu: elegí muchos juntos, el sistema los lee y los carga."
                  onClick={() => {
                    setCreating(null);
                    setImporting(true);
                  }}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Barrita de cuánto se cobró; lleva a los pagos del presupuesto (sección "Pagos" de su página) */
function PaymentProgress({ budget: b, percent }: { budget: Budget; percent: number }) {
  if (b.status === "rechazado") return <span className="text-muted-foreground">—</span>;
  return (
    <Link
      href={`/pagos/${b.id}#pagos`}
      className="block w-24 rounded-sm outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Pagos de ${b.number || "presupuesto"}: ${percent}% cobrado`}
      title="Ver y registrar los pagos"
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
