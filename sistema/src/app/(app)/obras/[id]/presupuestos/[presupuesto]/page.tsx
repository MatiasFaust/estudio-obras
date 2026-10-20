"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Lock, Settings2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { downloadBudgetPdf, previewBudgetPdf } from "@/components/budgets/budget-pdf";
import { BUDGET_STATUS } from "@/components/budgets/budget-status";
import { fillIntro, defaultTrabajo, IVA_LABEL, newBudgetFrom } from "@/components/budgets/budget-text";
import { readPrefill, type CalcPrefill } from "@/components/budgets/calculator";
import { linesToText, numText, parseOptional, PaymentTermsEditor, textToLines } from "@/components/budgets/form-parts";
import { CURRENCIES } from "@/lib/constants";
import { useAction, useBudgets, useBudgetSettings, useClients, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { can } from "@/lib/permissions";
import type { Budget, BudgetInput, BudgetSettings, Client, Project } from "@/lib/types";

const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, label]) => ({ value, label }));
const IVA_OPTIONS = Object.entries(IVA_LABEL).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = Object.entries(BUDGET_STATUS).map(([value, s]) => ({ value, label: s.label }));

function BudgetEditorPage() {
  const { id, presupuesto } = useParams<{ id: string; presupuesto: string }>();
  const search = useSearchParams();
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const projects = useProjects();
  const clients = useClients();
  const budgets = useBudgets(allowed);
  const settings = useBudgetSettings(allowed);

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  if (projects.isLoading || budgets.isLoading || settings.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const project = projects.data?.find((p) => p.id === id);
  const budget = presupuesto === "nuevo" ? null : budgets.data?.find((b) => b.id === presupuesto && b.project_id === id);
  if (!project || !settings.data || (presupuesto !== "nuevo" && !budget)) {
    return <EmptyState icon={FileText} title="Presupuesto no encontrado" action={<Link href="/pagos" className="text-sm text-primary">Volver a presupuestos</Link>} />;
  }
  const client = clients.data?.find((c) => c.id === project.client_id);
  // Lo calculado en la calculadora llega por la dirección (solo en un presupuesto nuevo)
  const prefill = budget ? null : readPrefill(search);
  return <BudgetForm key={budget?.updated_at ?? "nuevo"} project={project} client={client} settings={settings.data} budget={budget ?? null} prefill={prefill} />;
}

function BudgetForm({
  project, client, settings, budget, prefill,
}: { project: Project; client?: Client; settings: BudgetSettings; budget: Budget | null; prefill: CalcPrefill | null }) {
  const repo = useRepo();
  const router = useRouter();
  const { run, pending } = useAction();
  const firstIntro = {
    trabajo: prefill?.tipo ? `presentación de proyecto de ${prefill.tipo.toLowerCase()}` : defaultTrabajo(project),
    area: prefill?.area ?? "",
    padron: project.padron ?? "",
  };
  const fresh = newBudgetFrom(settings, project, client?.name);
  const start: BudgetInput = budget ?? {
    ...fresh,
    intro: fillIntro(settings.intro, firstIntro),
    price: prefill?.precio ?? fresh.price,
    wages_days: prefill?.jornales ?? fresh.wages_days,
    wages_amount: prefill?.jornalesMonto ?? fresh.wages_amount,
    expenses_amount: prefill?.gastos ?? fresh.expenses_amount,
  };
  const [b, setB] = useState(start);
  const [price, setPrice] = useState(numText(start.price));
  const [expenses, setExpenses] = useState(numText(start.expenses_amount));
  const [wagesDays, setWagesDays] = useState(numText(start.wages_days));
  const [wagesAmount, setWagesAmount] = useState(numText(start.wages_amount));
  const [includes, setIncludes] = useState(linesToText(start.includes));
  const [intro, setIntro] = useState(firstIntro);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const set = <K extends keyof BudgetInput>(k: K, v: BudgetInput[K]) => setB((x) => ({ ...x, [k]: v }));

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
      includes: textToLines(includes),
      payment_terms: b.payment_terms.filter((x) => x.label.trim() || x.percent),
    };
  }

  async function save(): Promise<Budget | null> {
    const input = current();
    if (!input) return null;
    const result: { saved?: Budget } = {};
    const ok = await run(async () => {
      if (budget) {
        await repo.updateBudget(budget.id, input);
        result.saved = { ...budget, ...input };
      } else {
        result.saved = await repo.createBudget(input);
      }
    }, budget ? "Presupuesto guardado" : "Presupuesto creado");
    if (ok && result.saved && !budget) router.replace(`/obras/${project.id}/presupuestos/${result.saved.id}`);
    return ok ? result.saved ?? null : null;
  }

  /** Para el PDF se usa lo que está en pantalla, aunque no se haya guardado */
  async function pdf(kind: "preview" | "download") {
    const input = current();
    if (!input) return;
    const doc: Budget = { ...(budget ?? { id: "nuevo", created_by: null, created_at: "", updated_at: "" }), ...input };
    // La pestaña se abre antes de generar el PDF para que el navegador no la bloquee
    const win = kind === "preview" ? window.open("", "_blank") : null;
    setBusyPdf(true);
    try {
      if (kind === "preview") await previewBudgetPdf(doc, settings, win);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link href="/pagos" className="inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="size-3.5" /> Presupuestos</Link>
        <span aria-hidden>·</span>
        <Link href={`/obras/${project.id}?tab=pagos`} className="hover:text-foreground">{project.name}</Link>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{budget ? `Presupuesto ${budget.number || "sin número"}` : "Nuevo presupuesto"}</h1>
          <p className="text-sm text-muted-foreground">{project.name}{client ? ` · ${client.name}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busyPdf} onClick={() => pdf("preview")}><Eye /> Vista previa</Button>
          <Button variant="outline" disabled={busyPdf} onClick={() => pdf("download")}><Download /> Descargar PDF</Button>
          <Button disabled={pending} onClick={() => save()}>{pending ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

      <Card size="sm">
        <CardHeader><CardTitle>Datos</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Número" htmlFor="bg-number" hint="Ej.: 2094">
              <Input id="bg-number" value={b.number} onChange={(e) => set("number", e.target.value)} />
            </Field>
            <Field label="Fecha" htmlFor="bg-date">
              <Input id="bg-date" type="date" value={b.issued_on} onChange={(e) => set("issued_on", e.target.value)} />
            </Field>
            <Field label="Estado">
              <SimpleSelect value={b.status} onChange={(v) => set("status", v as Budget["status"])} options={STATUS_OPTIONS} aria-label="Estado" />
            </Field>
          </div>
          <Field label="Para" htmlFor="bg-recipient" hint="Ej.: Sr. Nicolás">
            <Input id="bg-recipient" value={b.recipient} onChange={(e) => set("recipient", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Presentación</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_110px_auto] sm:items-end">
            <Field label="Trabajo" htmlFor="bg-trabajo">
              <Input id="bg-trabajo" value={intro.trabajo} onChange={(e) => setIntro((x) => ({ ...x, trabajo: e.target.value }))} />
            </Field>
            <Field label="Área (m²)" htmlFor="bg-area">
              <Input id="bg-area" inputMode="decimal" value={intro.area} onChange={(e) => setIntro((x) => ({ ...x, area: e.target.value }))} />
            </Field>
            <Field label="Padrón" htmlFor="bg-padron">
              <Input id="bg-padron" value={intro.padron} onChange={(e) => setIntro((x) => ({ ...x, padron: e.target.value }))} />
            </Field>
            <Button type="button" variant="outline" onClick={() => set("intro", fillIntro(settings.intro, intro))}>Armar párrafo</Button>
          </div>
          <Field label="Párrafo" htmlFor="bg-intro" hint="Lo podés corregir a mano. Negrita: **texto**. Subrayado: __texto__.">
            <Textarea id="bg-intro" rows={4} value={b.intro} onChange={(e) => set("intro", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Precio y forma de pago</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_190px_160px]">
            <Field label="Precio" htmlFor="bg-price" hint="Ej.: 102.000">
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
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Qué incluye</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="El proyecto incluye" htmlFor="bg-includes" hint="Una cosa por línea.">
            <Textarea id="bg-includes" rows={6} value={includes} onChange={(e) => setIncludes(e.target.value)} />
          </Field>
          <Field label="No se incluye" htmlFor="bg-excludes" optional>
            <Input id="bg-excludes" value={b.excludes} onChange={(e) => set("excludes", e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
            <Field label="Gastos" htmlFor="bg-expenses" optional>
              <Input id="bg-expenses" value={b.expenses_text} onChange={(e) => set("expenses_text", e.target.value)} />
            </Field>
            <Field label="Se estiman en" htmlFor="bg-expenses-amount" optional>
              <Input id="bg-expenses-amount" inputMode="decimal" value={expenses} onChange={(e) => setExpenses(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Jornales estimados" htmlFor="bg-wages-days" optional hint="Ej.: 129">
              <Input id="bg-wages-days" inputMode="decimal" value={wagesDays} onChange={(e) => setWagesDays(e.target.value)} />
            </Field>
            <Field label="Aproximado" htmlFor="bg-wages-amount" optional hint="Ej.: 283.800">
              <Input id="bg-wages-amount" inputMode="decimal" value={wagesAmount} onChange={(e) => setWagesAmount(e.target.value)} />
            </Field>
          </div>
          <Field label="Nota" htmlFor="bg-note" optional>
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

      {budget && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="¿Eliminar el presupuesto?"
          description="Se borra de la obra. Esta acción no se puede deshacer."
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
