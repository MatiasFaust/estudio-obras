"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Lock, Printer, Settings2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { BudgetPayments, useDeleteBudgetText } from "@/components/budgets/budget-payments";
import { downloadBudgetPdf, previewBudgetPdf, printBudgetPdf } from "@/components/budgets/budget-pdf";
import { BUDGET_STATUS_OPTIONS } from "@/components/budgets/budget-status";
import { fillIntro, IVA_LABEL, newBudgetFrom, trabajoFrom } from "@/components/budgets/budget-text";
import { readPrefill, type CalcPrefill } from "@/components/budgets/calculator";
import { linesToText, numText, parseOptional, PaymentTermsEditor, ResponsibleInput, textToLines } from "@/components/budgets/form-parts";
import { fillFromProject, ManualBudgetForm, NO_PROJECT, projectOptions } from "@/components/budgets/manual-budget-form";
import { CURRENCIES } from "@/lib/constants";
import { useAction, useBudgets, useBudgetSettings, useClients, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { can } from "@/lib/permissions";
import type { Budget, BudgetInput, BudgetSettings, Client, Project } from "@/lib/types";

const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, label]) => ({ value, label }));
const IVA_OPTIONS = Object.entries(IVA_LABEL).map(([value, label]) => ({ value, label }));

function BudgetEditorPage() {
  const { presupuesto } = useParams<{ presupuesto: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const repo = useRepo();
  const { run } = useAction();
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const projects = useProjects();
  const clients = useClients();
  const budgets = useBudgets(allowed);
  const settings = useBudgetSettings(allowed);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteText = useDeleteBudgetText(allowed && presupuesto !== "nuevo" ? presupuesto : undefined);

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  if (projects.isLoading || budgets.isLoading || settings.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const budget = presupuesto === "nuevo" ? null : budgets.data?.find((b) => b.id === presupuesto);
  if (!settings.data || (presupuesto !== "nuevo" && !budget)) {
    return <EmptyState icon={FileText} title="Presupuesto no encontrado" action={<Link href="/pagos" className="text-sm text-primary">Volver a presupuestos</Link>} />;
  }

  // Presupuesto manual: formulario corto, sin hoja membretada
  if (budget?.kind === "manual") {
    return (
      <div className="grid max-w-2xl gap-4">
        <Link href="/pagos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Presupuestos</Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Presupuesto {budget.number || "sin número"}</h1>
          <p className="text-sm text-muted-foreground">Manual con costo fijo (sin hoja membretada)</p>
        </div>
        <Card size="sm">
          <CardContent>
            <ManualBudgetForm
              key={budget.updated_at}
              budget={budget}
              settings={settings.data}
              projects={projects.data ?? []}
              clients={clients.data ?? []}
              onSaved={() => router.push("/pagos")}
              onCancel={() => router.push("/pagos")}
              onDelete={() => setConfirmDelete(true)}
            />
          </CardContent>
        </Card>
        <BudgetPayments budget={budget} project={projects.data?.find((p) => p.id === budget.project_id)} />
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="¿Eliminar el presupuesto?"
          description={deleteText}
          onConfirm={async () => {
            const ok = await run(() => repo.deleteBudget(budget.id), "Presupuesto eliminado");
            if (ok) router.replace("/pagos");
            return ok;
          }}
        />
      </div>
    );
  }

  // Obra elegida al crearlo (desde una obra o desde la calculadora) y lo calculado en la calculadora
  const obraId = budget ? null : search.get("obra");
  const prefill = budget ? null : readPrefill(search);
  return (
    <BudgetForm
      key={budget?.updated_at ?? "nuevo"}
      projects={projects.data ?? []}
      clients={clients.data ?? []}
      settings={settings.data}
      budget={budget ?? null}
      initialProjectId={obraId}
      prefill={prefill}
    />
  );
}

/** Presupuesto con hoja membretada: datos, presentación, precio y cuotas, qué incluye; genera el PDF */
function BudgetForm({
  projects, clients, settings, budget, initialProjectId, prefill,
}: {
  projects: Project[];
  clients: Client[];
  settings: BudgetSettings;
  budget: Budget | null;
  initialProjectId: string | null;
  prefill: CalcPrefill | null;
}) {
  const repo = useRepo();
  const router = useRouter();
  const { run, pending } = useAction();
  const [start] = useState<BudgetInput>(() => {
    if (budget) return budget;
    const service = prefill?.tipo ? `Proyecto de ${prefill.tipo.toLowerCase()}` : "";
    const project = projects.find((p) => p.id === initialProjectId) ?? null;
    const client = clients.find((c) => c.id === project?.client_id);
    const fresh = newBudgetFrom(settings, { project, clientName: client?.name, service, area: prefill?.area });
    return {
      ...fresh,
      price: prefill?.precio ?? fresh.price,
      wages_days: prefill?.jornales ?? fresh.wages_days,
      wages_amount: prefill?.jornalesMonto ?? fresh.wages_amount,
      expenses_amount: prefill?.gastos ?? fresh.expenses_amount,
    };
  });
  const [b, setB] = useState(start);
  const [price, setPrice] = useState(numText(start.price));
  const [expenses, setExpenses] = useState(numText(start.expenses_amount));
  const [wagesDays, setWagesDays] = useState(numText(start.wages_days));
  const [wagesAmount, setWagesAmount] = useState(numText(start.wages_amount));
  const [includes, setIncludes] = useState(linesToText(start.includes));
  const [intro, setIntro] = useState({ trabajo: trabajoFrom(start.service), area: prefill?.area ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const deleteText = useDeleteBudgetText(budget?.id);
  const set = <K extends keyof BudgetInput>(k: K, v: BudgetInput[K]) => setB((x) => ({ ...x, [k]: v }));
  const project = projects.find((p) => p.id === b.project_id);

  /** Arma el presupuesto con lo que está en pantalla (o null si hay un número mal escrito) */
  function current(): BudgetInput | null {
    const nums = { price: parseOptional(price), expenses_amount: parseOptional(expenses), wages_days: parseOptional(wagesDays), wages_amount: parseOptional(wagesAmount) };
    const bad = Object.entries(nums).find(([, v]) => v !== null && (Number.isNaN(v) || v < 0));
    if (bad) {
      setError("Hay un monto mal escrito. Usá solo números, por ejemplo 102.000 o 4.500,50.");
      return null;
    }
    setError(null);
    return {
      ...b, ...nums,
      kind: "membretado",
      responsible: b.responsible.trim(),
      includes: textToLines(includes),
      payment_terms: b.payment_terms.filter((x) => x.label.trim() || x.percent),
    };
  }

  async function save(): Promise<Budget | null> {
    const input = current();
    if (!input) return null;
    if (!input.client_name.trim()) {
      setError("Ingresá el cliente.");
      return null;
    }
    const result: { saved?: Budget } = {};
    const ok = await run(async () => {
      if (budget) {
        await repo.updateBudget(budget.id, input);
        result.saved = { ...budget, ...input };
      } else {
        result.saved = await repo.createBudget(input);
      }
    }, budget ? "Presupuesto guardado" : "Presupuesto creado");
    if (ok && result.saved && !budget) router.replace(`/pagos/${result.saved.id}`);
    return ok ? result.saved ?? null : null;
  }

  /** Para el PDF se usa lo que está en pantalla, aunque no se haya guardado */
  async function pdf(kind: "preview" | "download" | "print") {
    const input = current();
    if (!input) return;
    const doc: Budget = { ...(budget ?? { id: "nuevo", created_by: null, created_at: "", updated_at: "" }), ...input };
    // La pestaña se abre antes de generar el PDF para que el navegador no la bloquee
    const win = kind === "preview" ? window.open("", "_blank") : null;
    setBusyPdf(true);
    try {
      if (kind === "preview") await previewBudgetPdf(doc, settings, win);
      else if (kind === "print") await printBudgetPdf(doc, settings);
      else await downloadBudgetPdf(doc, settings);
    } catch {
      win?.close();
      setError("No se pudo generar el PDF. Probá de nuevo.");
    } finally {
      setBusyPdf(false);
    }
  }

  return (
    <div className="grid max-w-3xl gap-4">
      <Link href="/pagos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Presupuestos</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{budget ? `Presupuesto ${budget.number || "sin número"}` : "Nuevo presupuesto"}</h1>
          <p className="text-sm text-muted-foreground">
            Con hoja membretada{b.client_name.trim() ? ` · ${b.client_name.trim()}` : ""}{project ? ` · ${project.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busyPdf} onClick={() => pdf("preview")}><Eye /> Vista previa</Button>
          <Button variant="outline" disabled={busyPdf} onClick={() => pdf("print")}><Printer /> Imprimir</Button>
          <Button variant="outline" disabled={busyPdf} onClick={() => pdf("download")}><Download /> Descargar PDF</Button>
          <Button disabled={pending} onClick={() => save()}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Card size="sm">
        <CardHeader><CardTitle>Cliente e inmueble</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <Field label="Cliente" htmlFor="bg-client">
              <Input id="bg-client" value={b.client_name} onChange={(e) => set("client_name", e.target.value)} />
            </Field>
            <Field label="Para (encabezado de la carta)" htmlFor="bg-recipient" optional hint="Ej.: Sr. Nicolás. Si queda vacío, va el cliente.">
              <Input id="bg-recipient" value={b.recipient} onChange={(e) => set("recipient", e.target.value)} />
            </Field>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Padrón" htmlFor="bg-padron">
              <Input id="bg-padron" value={b.padron} onChange={(e) => set("padron", e.target.value)} />
            </Field>
            <Field label="Dirección del inmueble" htmlFor="bg-address">
              <Input id="bg-address" value={b.address} onChange={(e) => set("address", e.target.value)} />
            </Field>
          </div>
          <Field label="Servicio" htmlFor="bg-service" hint="Ej.: Proyecto de reforma">
            <Input
              id="bg-service"
              value={b.service}
              onChange={(e) => {
                set("service", e.target.value);
                setIntro((x) => ({ ...x, trabajo: trabajoFrom(e.target.value) }));
              }}
            />
          </Field>
          <Field label="Obra" hint="Opcional. Si la vinculás, el presupuesto aparece en la obra y, al aceptarlo, pasa a ser su monto a cobrar.">
            <SimpleSelect
              value={b.project_id ?? NO_PROJECT}
              onChange={(v) => setB((x) => fillFromProject(x, v, projects, clients))}
              options={projectOptions(projects, clients)}
              aria-label="Obra"
            />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Datos del presupuesto</CardTitle></CardHeader>
        <CardContent className="grid items-start gap-3 sm:grid-cols-3">
          <Field label="Número" htmlFor="bg-number" hint="Ej.: 2094">
            <Input id="bg-number" value={b.number} onChange={(e) => set("number", e.target.value)} />
          </Field>
          <Field label="Fecha" htmlFor="bg-date">
            <Input id="bg-date" type="date" value={b.issued_on} onChange={(e) => set("issued_on", e.target.value)} />
          </Field>
          <Field label="Estado">
            <SimpleSelect value={b.status} onChange={(v) => set("status", v as Budget["status"])} options={BUDGET_STATUS_OPTIONS} aria-label="Estado" />
          </Field>
          <Field label="Responsables" htmlFor="bg-responsible" optional className="sm:col-span-3">
            <ResponsibleInput id="bg-responsible" value={b.responsible} onChange={(v) => set("responsible", v)} />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Descripción del trabajo</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_auto] sm:items-end">
            <Field label="Trabajo" htmlFor="bg-trabajo">
              <Input id="bg-trabajo" value={intro.trabajo} onChange={(e) => setIntro((x) => ({ ...x, trabajo: e.target.value }))} />
            </Field>
            <Field label="Área (m²)" htmlFor="bg-area">
              <Input id="bg-area" inputMode="decimal" value={intro.area} onChange={(e) => setIntro((x) => ({ ...x, area: e.target.value }))} />
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={() => set("intro", fillIntro(settings.intro, { ...intro, padron: b.padron, direccion: b.address }))}
            >
              Armar párrafo
            </Button>
          </div>
          <Field label="Párrafo de presentación" htmlFor="bg-intro" hint="Lo podés corregir a mano. Negrita: **texto**. Subrayado: __texto__.">
            <Textarea id="bg-intro" rows={4} value={b.intro} onChange={(e) => set("intro", e.target.value)} />
          </Field>
          <Field label="El proyecto incluye" htmlFor="bg-includes" hint="Una cosa por línea.">
            <Textarea id="bg-includes" rows={6} value={includes} onChange={(e) => setIncludes(e.target.value)} />
          </Field>
          <Field label="No se incluye" htmlFor="bg-excludes" optional>
            <Input id="bg-excludes" value={b.excludes} onChange={(e) => set("excludes", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Honorarios y condiciones de pago</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_190px_160px]">
            <Field label="Honorarios" htmlFor="bg-price" hint="Ej.: 102.000">
              <Input id="bg-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Moneda">
              <SimpleSelect value={b.currency} onChange={(v) => set("currency", v as Budget["currency"])} options={CURRENCY_OPTIONS} aria-label="Moneda" />
            </Field>
            <Field label="IVA">
              <SimpleSelect value={b.iva_mode} onChange={(v) => set("iva_mode", v as Budget["iva_mode"])} options={IVA_OPTIONS} aria-label="IVA" />
            </Field>
          </div>
          <PaymentTermsEditor
            terms={b.payment_terms}
            onChange={(v) => set("payment_terms", v)}
            price={(() => { const n = parseOptional(price); return n === null || Number.isNaN(n) ? null : n; })()}
            currency={b.currency}
          />
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Gastos" htmlFor="bg-expenses" optional>
              <Input id="bg-expenses" value={b.expenses_text} onChange={(e) => set("expenses_text", e.target.value)} />
            </Field>
            <Field label="Se estiman en" htmlFor="bg-expenses-amount" optional>
              <Input id="bg-expenses-amount" inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </Field>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <Field label="Jornales estimados" htmlFor="bg-wages-days" optional hint="Ej.: 129">
              <Input id="bg-wages-days" inputMode="decimal" value={wagesDays} onChange={(e) => setWagesDays(e.target.value)} />
            </Field>
            <Field label="Aproximado" htmlFor="bg-wages-amount" optional hint="Ej.: 283.800">
              <Input id="bg-wages-amount" inputMode="decimal" value={wagesAmount} onChange={(e) => setWagesAmount(e.target.value)} />
            </Field>
          </div>
          <Field label="Observaciones" htmlFor="bg-note" optional hint="Aparece en el PDF como “Nota”.">
            <Textarea id="bg-note" rows={2} value={b.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/pagos/plantilla" className={buttonVariants({ variant: "ghost", size: "sm" })}><Settings2 /> Plantilla (firmas, pie, textos fijos)</Link>
        <div className="flex flex-wrap gap-2">
          {budget && <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 /> Eliminar</Button>}
          <Button disabled={pending} onClick={() => save()}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>

      {budget && <BudgetPayments budget={budget} project={projects.find((p) => p.id === budget.project_id)} />}

      {budget && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="¿Eliminar el presupuesto?"
          description={deleteText}
          onConfirm={async () => {
            const ok = await run(() => repo.deleteBudget(budget.id), "Presupuesto eliminado");
            if (ok) router.replace("/pagos");
            return ok;
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <BudgetEditorPage />
    </Suspense>
  );
}
