"use client";

import { format } from "date-fns";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { useAction, useRepo } from "@/lib/data/hooks";
import { formatDate } from "@/lib/format";
import type { Budget, BudgetInput, BudgetStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BUDGET_STATUS_OPTIONS } from "./budget-status";
import { money } from "./budget-text";
import { parseBudgetLines, type ImportedBudget } from "./pdf-import";
import { readPdfLines } from "./pdf-read";

interface Row {
  key: string;
  fileName: string;
  data: ImportedBudget | null;
  error: string | null;
  duplicate: boolean;
  include: boolean;
  done: boolean;
}

/** Presupuesto a crear con lo leído del PDF (recortado a los largos que acepta la base) */
function toInput(d: ImportedBudget, status: BudgetStatus): BudgetInput {
  return {
    kind: "membretado",
    project_id: null,
    client_name: d.client_name.slice(0, 160),
    padron: d.padron.slice(0, 30),
    address: d.address.slice(0, 160),
    service: d.service.slice(0, 160),
    number: d.number.slice(0, 30),
    issued_on: d.issued_on ?? format(new Date(), "yyyy-MM-dd"),
    recipient: d.recipient.slice(0, 160),
    intro: d.intro.slice(0, 2000),
    price: d.price,
    currency: d.currency,
    iva_mode: d.iva_mode,
    payment_terms: d.payment_terms,
    includes: d.includes,
    excludes: d.excludes.slice(0, 500),
    expenses_text: d.expenses_text.slice(0, 500),
    expenses_amount: d.expenses_amount,
    wages_days: d.wages_days,
    wages_amount: d.wages_amount,
    note: d.note.slice(0, 1000),
    status,
    responsible: "",
  };
}

/**
 * Subir presupuestos en PDF (los que ya están en la compu): se eligen muchos juntos, el sistema
 * los lee, muestra lo que encontró para revisarlo y los crea como si se hubieran hecho acá.
 */
export function ImportBudgetsDialog({ open, onOpenChange, existing }: { open: boolean; onOpenChange: (o: boolean) => void; existing: Budget[] }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [rows, setRows] = useState<Row[]>([]);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [status, setStatus] = useState<BudgetStatus>("enviado");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const chosen = rows.filter((r) => r.include && r.data && !r.done);
  const busy = !!reading || pending;

  async function addFiles(list: FileList | File[]) {
    const files = [...list].filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!files.length) {
      toast.error("Elegí archivos PDF.");
      return;
    }
    // Números ya cargados en el sistema o elegidos en esta tanda: no se repiten
    const seen = new Set([
      ...existing.map((b) => b.number.trim()),
      ...rows.filter((r) => r.data && (r.include || r.done)).map((r) => r.data!.number),
    ].filter(Boolean));
    setReading({ done: 0, total: files.length });
    for (const [i, f] of files.entries()) {
      const key = `${Date.now()}-${i}-${f.name}`;
      let row: Row;
      try {
        const lines = await readPdfLines(f);
        if (!lines.length) throw new Error("El PDF no tiene texto (puede ser una foto o un escaneo).");
        const data = parseBudgetLines(lines, f.name);
        const duplicate = !!data.number && seen.has(data.number);
        if (data.number) seen.add(data.number);
        const unreadable = data.missing.includes("cliente") && data.missing.includes("honorarios");
        row = { key, fileName: f.name, data, error: null, duplicate, include: !duplicate && !unreadable, done: false };
      } catch (e) {
        row = { key, fileName: f.name, data: null, error: e instanceof Error ? e.message : "No se pudo leer el PDF.", duplicate: false, include: false, done: false };
      }
      setRows((rs) => [...rs, row]);
      setReading({ done: i + 1, total: files.length });
    }
    setReading(null);
  }

  async function create() {
    const list = chosen;
    const ok = await run(async () => {
      for (const r of list) {
        await repo.createBudget(toInput(r.data!, status));
        setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, done: true, include: false } : x)));
      }
    }, list.length === 1 ? "1 presupuesto cargado" : `${list.length} presupuestos cargados`);
    if (ok) close(false);
  }

  function close(o: boolean) {
    if (busy) return;
    if (!o) setRows([]);
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Subir presupuestos en PDF</DialogTitle>
          <DialogDescription>
            Elegí los PDF de los presupuestos que ya tenés (podés marcar muchos juntos). El sistema los lee y los carga como si
            los hubieras hecho acá. Los archivos no se suben: solo se guardan los datos.
          </DialogDescription>
        </DialogHeader>

        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "grid place-items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging ? "border-primary bg-primary/5" : "hover:bg-accent",
          )}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <span className="font-medium">{reading ? `Leyendo ${reading.done} de ${reading.total}…` : "Elegir los PDF o arrastrarlos acá"}</span>
          <span className="text-xs text-muted-foreground">En la carpeta, con Ctrl + A se marcan todos.</span>
        </button>
        <input
          ref={input}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          aria-label="PDF de presupuestos"
          onChange={(e) => {
            const files = e.target.files ? [...e.target.files] : [];
            e.target.value = "";
            if (files.length) addFiles(files);
          }}
        />

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>N.º</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Servicio</TableHead>
                  <TableHead className="text-right">Honorarios</TableHead>
                  <TableHead>Revisar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key} data-file={r.fileName}>
                    <TableCell>
                      {r.done ? (
                        <CheckCircle2 className="size-4 text-emerald-600" aria-label="Cargado" />
                      ) : (
                        <Checkbox
                          checked={r.include}
                          disabled={!r.data || busy}
                          onCheckedChange={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, include: !!v } : x)))}
                          aria-label={`Cargar ${r.fileName}`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{r.data?.number || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.data?.issued_on ? formatDate(r.data.issued_on) : "—"}</TableCell>
                    <TableCell className="max-w-44 truncate">{r.data?.client_name || "—"}</TableCell>
                    <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell">{r.data?.service || "—"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{r.data?.price != null ? money(r.data.price, r.data.currency) : "—"}</TableCell>
                    <TableCell className="max-w-60 text-xs">
                      <span className="block truncate text-muted-foreground" title={r.fileName}>{r.fileName}</span>
                      {r.done ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Cargado</span>
                      ) : r.error ? (
                        <span className="text-destructive">{r.error}</span>
                      ) : r.duplicate ? (
                        <span className="text-amber-700 dark:text-amber-400">Ya está cargado (mismo número)</span>
                      ) : r.data && r.data.missing.length > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400">No encontré: {r.data.missing.join(", ")}</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">Leído completo</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="items-end gap-3 sm:justify-between">
          <Field label="Estado de los que se cargan" className="w-full sm:w-56">
            <SimpleSelect value={status} onChange={(v) => setStatus(v as BudgetStatus)} options={BUDGET_STATUS_OPTIONS} aria-label="Estado de los presupuestos cargados" />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => close(false)}>Cancelar</Button>
            <Button disabled={busy || chosen.length === 0} onClick={create}>
              <Upload /> {pending ? "Cargando…" : chosen.length === 1 ? "Crear 1 presupuesto" : `Crear ${chosen.length} presupuestos`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
