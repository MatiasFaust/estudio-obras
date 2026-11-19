"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { useAction, useRepo } from "@/lib/data/hooks";
import { matches } from "@/lib/format";
import type { Budget, PermitFile, PermitFileInput, PermitOffice, PermitTask } from "@/lib/types";
import { OFFICE_OPTIONS, TASK_OPTIONS } from "./permit-status";

const EMPTY: PermitFileInput = {
  budget_id: null, budget_number: "", padron: "", client_name: "", service: "", file_number: "", office: null, task: null, notes: "",
};

/** Lo que se copia del presupuesto al expediente */
const fromBudget = (b: Budget): Partial<PermitFileInput> => ({
  budget_id: b.id, budget_number: b.number, padron: b.padron, client_name: b.client_name, service: b.service,
});

/**
 * Nuevo expediente o editar uno: se elige el presupuesto (completa número, padrón, cliente y servicio)
 * o se carga a mano; después, número de expediente y en qué oficina y tarea está.
 */
export function PermitFileDialog({ file, budgets, onClose }: { file: PermitFile | null; budgets: Budget[]; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [f, setF] = useState<PermitFileInput>(() => (file ? { ...file } : EMPTY));
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PermitFileInput>(k: K, v: PermitFileInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const linked = f.budget_id ? budgets.find((b) => b.id === f.budget_id) : undefined;
  const found = search.trim()
    ? budgets.filter((b) => matches(search, b.number, b.client_name, b.padron, b.service)).slice(0, 8)
    : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const input = { ...f, client_name: f.client_name.trim(), file_number: f.file_number.trim(), padron: f.padron.trim(), service: f.service.trim(), notes: f.notes.trim() };
    if (!input.client_name && !input.file_number) {
      setError("Elegí un presupuesto, o escribí al menos el cliente o el número de expediente.");
      return;
    }
    setError(null);
    const ok = await run(
      () => (file ? repo.updatePermitFile(file.id, input) : repo.createPermitFile(input)),
      file ? "Expediente guardado" : "Expediente creado",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={save} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{file ? "Editar expediente" : "Nuevo expediente"}</DialogTitle>
            <DialogDescription>Elegí el presupuesto y se completan solos el número, el padrón, el cliente y el servicio.</DialogDescription>
          </DialogHeader>

          <Field label="Presupuesto" hint={linked ? undefined : "Buscá por número, cliente o padrón. Si no tiene presupuesto, completá los datos a mano."}>
            {linked ? (
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span><b>{linked.number || "Sin número"}</b> · {linked.client_name || "Sin cliente"}{linked.service ? ` · ${linked.service}` : ""}</span>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar el presupuesto" onClick={() => set("budget_id", null)}><X /></Button>
              </div>
            ) : (
              <div className="grid gap-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej.: 2177, Goicochea o un padrón" className="pl-8" aria-label="Buscar presupuesto" autoFocus />
                </div>
                {found.length > 0 && (
                  <div className="grid max-h-56 overflow-y-auto rounded-md border" role="listbox" aria-label="Presupuestos encontrados">
                    {found.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => { setF((x) => ({ ...x, ...fromBudget(b) })); setSearch(""); }}
                        className="border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                      >
                        <b className="tabular-nums">{b.number || "Sin número"}</b> · {b.client_name || "Sin cliente"}
                        <span className="block text-xs text-muted-foreground">{[b.padron && `Padrón ${b.padron}`, b.service].filter(Boolean).join(" · ") || "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {search.trim() && found.length === 0 && <p className="text-xs text-muted-foreground">No encontré presupuestos con eso.</p>}
              </div>
            )}
          </Field>

          <div className="grid items-start gap-3 sm:grid-cols-[140px_140px_1fr]">
            <Field label="N.º de presupuesto" htmlFor="ex-number" optional>
              <Input id="ex-number" value={f.budget_number} maxLength={30} onChange={(e) => set("budget_number", e.target.value)} />
            </Field>
            <Field label="Padrón" htmlFor="ex-padron" optional>
              <Input id="ex-padron" value={f.padron} maxLength={30} onChange={(e) => set("padron", e.target.value)} />
            </Field>
            <Field label="Cliente" htmlFor="ex-client">
              <Input id="ex-client" value={f.client_name} maxLength={160} onChange={(e) => set("client_name", e.target.value)} />
            </Field>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_180px]">
            <Field label="Servicio" htmlFor="ex-service" optional>
              <Input id="ex-service" value={f.service} maxLength={160} onChange={(e) => set("service", e.target.value)} />
            </Field>
            <Field label="N.º de expediente" htmlFor="ex-file" optional>
              <Input id="ex-file" value={f.file_number} maxLength={40} onChange={(e) => set("file_number", e.target.value)} placeholder="Ej.: 21/0224/2026" />
            </Field>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <Field label="Oficina" optional>
              <SimpleSelect value={f.office ?? ""} onChange={(v) => set("office", (v || null) as PermitOffice | null)} options={OFFICE_OPTIONS} placeholder="Sin definir" aria-label="Oficina" />
            </Field>
            <Field label="Tarea" optional>
              <SimpleSelect value={f.task ?? ""} onChange={(v) => set("task", (v || null) as PermitTask | null)} options={TASK_OPTIONS} placeholder="Sin definir" aria-label="Tarea" />
            </Field>
          </div>
          <Field label="Observaciones" htmlFor="ex-notes" optional>
            <Textarea id="ex-notes" rows={2} value={f.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} />
          </Field>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : file ? "Guardar" : "Crear expediente"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
