"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { CURRENCIES } from "@/lib/constants";
import { useAction, useRepo } from "@/lib/data/hooks";
import type { Budget, BudgetInput, BudgetSettings, Client, Project } from "@/lib/types";
import { BUDGET_STATUS_OPTIONS } from "./budget-status";
import { newBudgetFrom } from "./budget-text";
import { numText, parseOptional } from "./form-parts";

const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, label]) => ({ value, label }));
export const NO_PROJECT = "sin-obra";

/** Opciones para vincular un presupuesto a una obra (o a ninguna) */
export function projectOptions(projects: Project[], clients: Client[]) {
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  return [{ value: NO_PROJECT, label: "Sin obra" }].concat(
    projects
      .filter((p) => p.status !== "archivada")
      .map((p) => ({ value: p.id, label: `${p.name}${p.client_id && clientName.get(p.client_id) ? ` · ${clientName.get(p.client_id)}` : ""}` })),
  );
}

/** Al elegir una obra, completa cliente, padrón y dirección que estén vacíos */
export function fillFromProject<T extends Pick<BudgetInput, "project_id" | "client_name" | "padron" | "address">>(
  b: T, projectId: string, projects: Project[], clients: Client[],
): T {
  if (projectId === NO_PROJECT) return { ...b, project_id: null };
  const p = projects.find((x) => x.id === projectId);
  if (!p) return b;
  const client = clients.find((c) => c.id === p.client_id);
  return {
    ...b,
    project_id: p.id,
    client_name: b.client_name.trim() ? b.client_name : client?.name ?? "",
    padron: b.padron.trim() ? b.padron : p.padron ?? "",
    address: b.address.trim() ? b.address : p.address,
  };
}

/** Presupuesto manual con costo fijo: un importe ya acordado, sin hoja membretada ni PDF */
export function ManualBudgetForm({
  budget, settings, projects, clients, onSaved, onCancel, onDelete, initialProjectId,
}: {
  budget?: Budget | null;
  settings: BudgetSettings;
  projects: Project[];
  clients: Client[];
  onSaved?: (b: Budget) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  initialProjectId?: string;
}) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [b, setB] = useState<BudgetInput>(() => {
    const fresh = newBudgetFrom(settings, { kind: "manual" });
    return budget ?? (initialProjectId ? fillFromProject(fresh, initialProjectId, projects, clients) : fresh);
  });
  const [price, setPrice] = useState(numText(b.price));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof BudgetInput>(k: K, v: BudgetInput[K]) => setB((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const n = parseOptional(price);
    const err: Record<string, string> = {};
    if (!b.client_name.trim()) err.client = "Ingresá el cliente";
    if (!b.service.trim()) err.service = "Ingresá el servicio";
    if (n === null || Number.isNaN(n) || n < 0) err.price = "Ingresá los honorarios (ej.: 85.000)";
    setErrors(err);
    if (Object.keys(err).length) return;
    const input: BudgetInput = { ...b, kind: "manual", price: n, client_name: b.client_name.trim(), service: b.service.trim() };
    const result: { saved?: Budget } = {};
    const ok = await run(async () => {
      if (budget) {
        await repo.updateBudget(budget.id, input);
        result.saved = { ...budget, ...input };
      } else {
        result.saved = await repo.createBudget(input);
      }
    }, budget ? "Presupuesto guardado" : "Presupuesto registrado");
    if (ok && result.saved) onSaved?.(result.saved);
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-3">
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="mb-client" error={errors.client}>
          <Input id="mb-client" autoFocus value={b.client_name} onChange={(e) => set("client_name", e.target.value)} aria-invalid={!!errors.client} />
        </Field>
        <Field label="Padrón" htmlFor="mb-padron" optional>
          <Input id="mb-padron" value={b.padron} onChange={(e) => set("padron", e.target.value)} />
        </Field>
      </div>
      <Field label="Servicio" htmlFor="mb-service" error={errors.service} hint="Ej.: Regularización, Proyecto de reforma, Habilitación de bomberos">
        <Input id="mb-service" value={b.service} onChange={(e) => set("service", e.target.value)} aria-invalid={!!errors.service} />
      </Field>
      <div className="grid items-start gap-3 sm:grid-cols-[1fr_190px]">
        <Field label="Honorarios" htmlFor="mb-price" error={errors.price}>
          <Input id="mb-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={!!errors.price} />
        </Field>
        <Field label="Moneda">
          <SimpleSelect value={b.currency} onChange={(v) => set("currency", v as Budget["currency"])} options={CURRENCY_OPTIONS} aria-label="Moneda" />
        </Field>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-3">
        <Field label="Avance">
          <SimpleSelect value={b.status} onChange={(v) => set("status", v as Budget["status"])} options={BUDGET_STATUS_OPTIONS} aria-label="Avance" />
        </Field>
        <Field label="Número" htmlFor="mb-number" optional>
          <Input id="mb-number" value={b.number} onChange={(e) => set("number", e.target.value)} />
        </Field>
        <Field label="Fecha" htmlFor="mb-date">
          <Input id="mb-date" type="date" value={b.issued_on} onChange={(e) => set("issued_on", e.target.value)} />
        </Field>
      </div>
      <Field label="Obra" hint="Opcional. Si la vinculás, al aceptarlo pasa a ser el monto a cobrar de esa obra.">
        <SimpleSelect
          value={b.project_id ?? NO_PROJECT}
          onChange={(v) => setB((x) => fillFromProject(x, v, projects, clients))}
          options={projectOptions(projects, clients)}
          aria-label="Obra"
        />
      </Field>
      <Field label="Observaciones" htmlFor="mb-note" optional>
        <Textarea id="mb-note" rows={2} value={b.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>{onDelete && <Button type="button" variant="ghost" onClick={onDelete}>Eliminar</Button>}</div>
        <div className="flex gap-2">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>}
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar presupuesto"}</Button>
        </div>
      </div>
    </form>
  );
}
