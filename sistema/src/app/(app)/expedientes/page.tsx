"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, FolderOpen, Lock, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { PermitFileDialog } from "@/components/permits/permit-file-dialog";
import { OFFICE_OPTIONS, PERMIT_OFFICES, PERMIT_TASKS, TASK_OPTIONS } from "@/components/permits/permit-status";
import { useAction, useBudgets, usePermitFiles, useRepo, useSession } from "@/lib/data/hooks";
import { matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { PermitFile, PermitOffice, PermitTask } from "@/lib/types";
import { cn } from "@/lib/utils";

const NONE = "sin-definir";
const OFFICE_FILTER = [{ value: "", label: "Todas las oficinas" }, ...OFFICE_OPTIONS, { value: NONE, label: "Sin oficina" }];
const TASK_FILTER = [{ value: "", label: "Todas las tareas" }, ...TASK_OPTIONS, { value: NONE, label: "Sin tarea" }];

/** Por número de presupuesto, como números y el más alto arriba; los que no tienen, al final */
function byNumber(a: PermitFile, b: PermitFile) {
  if (!a.budget_number !== !b.budget_number) return a.budget_number ? -1 : 1;
  return b.budget_number.localeCompare(a.budget_number, "es", { numeric: true }) || b.created_at.localeCompare(a.created_at);
}

/** Expedientes: como la lista de presupuestos, con el estado (oficina y tarea) para cambiar ahí mismo */
export default function PermitFilesPage() {
  const repo = useRepo();
  const { run } = useAction();
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const files = usePermitFiles(allowed);
  const budgets = useBudgets(allowed);
  const [query, setQuery] = useState("");
  const [office, setOffice] = useState("");
  const [task, setTask] = useState("");
  const [editing, setEditing] = useState<{ file: PermitFile | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<PermitFile | null>(null);

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="Los expedientes son solo para administradores." />;

  const all = [...(files.data ?? [])].sort(byNumber);
  const rows = all.filter((f) =>
    (!office || (office === NONE ? !f.office : f.office === office))
    && (!task || (task === NONE ? !f.task : f.task === task))
    && matches(query, f.budget_number, f.padron, f.client_name, f.service, f.file_number, f.notes));
  const label = (f: PermitFile) => f.file_number || f.client_name || "el expediente";
  const change = (f: PermitFile, patch: Partial<Pick<PermitFile, "office" | "task">>) => run(() => repo.updatePermitFile(f.id, patch));

  return (
    <>
      <PageHeader
        title="Expedientes"
        description={`${rows.length} de ${all.length} expedientes`}
        actions={<Button onClick={() => setEditing({ file: null, key: Date.now() })}><Plus /> Expediente</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número, padrón, cliente, expediente…" className="pl-8" aria-label="Buscar expedientes" />
        </div>
        <SimpleSelect value={office} onChange={setOffice} options={OFFICE_FILTER} placeholder="Todas las oficinas" className="w-52" aria-label="Filtrar por oficina" />
        <SimpleSelect value={task} onChange={setTask} options={TASK_FILTER} placeholder="Todas las tareas" className="w-56" aria-label="Filtrar por tarea" />
      </div>

      {files.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando expedientes…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={all.length ? "Ningún expediente coincide con la búsqueda" : "Todavía no hay expedientes"}
          action={!all.length && <Button onClick={() => setEditing({ file: null, key: Date.now() })}><Plus /> Expediente</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2}>N.º</TableHead>
                <TableHead rowSpan={2} className="hidden sm:table-cell">Padrón</TableHead>
                <TableHead rowSpan={2}>Cliente</TableHead>
                <TableHead rowSpan={2} className="hidden md:table-cell">Servicio</TableHead>
                <TableHead rowSpan={2}>Expediente</TableHead>
                <TableHead colSpan={2} className="h-8 border-l text-center">Estado</TableHead>
                <TableHead rowSpan={2} className="w-12" />
              </TableRow>
              <TableRow>
                <TableHead className="h-8 border-l">Oficina</TableHead>
                <TableHead className="h-8">Tarea</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium tabular-nums">
                    {f.budget_id && f.budget_number
                      ? <Link href={`/pagos/${f.budget_id}`} className="hover:underline" title="Ver el presupuesto">{f.budget_number}</Link>
                      : f.budget_number || "—"}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{f.padron || "—"}</TableCell>
                  <TableCell className="max-w-48">
                    <span className="block truncate">{f.client_name || "—"}</span>
                    {f.notes && <span className="block truncate text-xs text-muted-foreground" title={f.notes}>{f.notes}</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell" title={f.service || undefined}>{f.service || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{f.file_number || "—"}</TableCell>
                  <TableCell className="border-l">
                    <ChoiceCell
                      value={f.office}
                      labels={PERMIT_OFFICES}
                      ariaLabel={`Cambiar oficina de ${label(f)}`}
                      onChange={(v) => change(f, { office: v as PermitOffice | null })}
                    />
                  </TableCell>
                  <TableCell>
                    <ChoiceCell
                      value={f.task}
                      labels={PERMIT_TASKS}
                      ariaLabel={`Cambiar tarea de ${label(f)}`}
                      onChange={(v) => change(f, { task: v as PermitTask | null })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button size="icon-sm" variant="ghost" aria-label={`Más opciones de ${label(f)}`} title="Editar o eliminar"><MoreHorizontal /></Button>}
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setEditing({ file: f, key: Date.now() })}><Pencil /> Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(f)}><Trash2 /> Eliminar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <PermitFileDialog key={editing.key} file={editing.file} budgets={budgets.data ?? []} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar el expediente?"
        description={`Se elimina ${deleting ? label(deleting) : "el expediente"}. El presupuesto no se toca. Esta acción no se puede deshacer.`}
        onConfirm={() => run(() => repo.deletePermitFile(deleting!.id), "Expediente eliminado")}
      />
    </>
  );
}

/** Desplegable dentro de la tabla para elegir la oficina o la tarea (o dejarla sin definir) */
function ChoiceCell({ value, labels, ariaLabel, onChange }: {
  value: string | null;
  labels: Record<string, string>;
  ariaLabel: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className="inline-flex items-center gap-1 rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", value ? "bg-muted text-foreground" : "text-muted-foreground")}>
              {value ? labels[value] : "Elegir"}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup value={value ?? NONE} onValueChange={(v) => { const next = v === NONE ? null : (v as string); if (next !== value) onChange(next); }}>
          {Object.entries(labels).map(([v, l]) => <DropdownMenuRadioItem key={v} value={v}>{l}</DropdownMenuRadioItem>)}
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value={NONE}>Sin definir</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
