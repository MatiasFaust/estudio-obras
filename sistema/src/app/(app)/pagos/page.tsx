"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, FilePlus2, FileText, Lock, Search, Settings2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { downloadBudgetPdf } from "@/components/budgets/budget-pdf";
import { BUDGET_STATUS, BudgetStatusBadge } from "@/components/budgets/budget-status";
import { money } from "@/components/budgets/budget-text";
import { useBudgets, useBudgetSettings, useClients, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Budget } from "@/lib/types";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(
  Object.entries(BUDGET_STATUS).map(([value, s]) => ({ value, label: s.label })),
);

/** Presupuestos: el creador de presupuestos (todas las obras) */
export default function BudgetsPage() {
  const router = useRouter();
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const budgets = useBudgets(allowed);
  const settings = useBudgetSettings(allowed);
  const projects = useProjects();
  const clients = useClients();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const projectById = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p])), [projects.data]);
  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);

  if (!allowed) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  }

  const clientOf = (b: Budget) => {
    const p = projectById.get(b.project_id);
    return p?.client_id ? clientName.get(p.client_id) ?? "" : "";
  };
  const all = budgets.data ?? [];
  const rows = all.filter((b) => {
    const p = projectById.get(b.project_id);
    return (!status || b.status === status) && matches(query, b.number, b.recipient, p?.name, p?.code, clientOf(b));
  });
  const openProjects = (projects.data ?? []).filter((p) => p.status !== "archivada");

  async function download(b: Budget) {
    if (!settings.data) return;
    setBusy(b.id);
    try {
      await downloadBudgetPdf(b, settings.data);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Presupuestos"
        description={`${rows.length} de ${all.length} presupuestos`}
        actions={
          <>
            <Link href="/pagos/plantilla" className={buttonVariants({ variant: "outline" })}><Settings2 /> Plantilla</Link>
            <Button onClick={() => setChoosing(true)}><FilePlus2 /> Nuevo presupuesto</Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Número, obra, cliente…" className="pl-8" aria-label="Buscar presupuestos" />
        </div>
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_FILTER} placeholder="Todos los estados" className="w-44" aria-label="Filtrar por estado" />
      </div>

      {budgets.isLoading || projects.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando presupuestos…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={all.length ? "Ningún presupuesto coincide con la búsqueda" : "Todavía no hay presupuestos"}
          action={!all.length && <Button onClick={() => setChoosing(true)}><FilePlus2 /> Nuevo presupuesto</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => {
                const p = projectById.get(b.project_id);
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/obras/${b.project_id}/presupuestos/${b.id}`} className="font-medium hover:underline">{b.number || "Sin número"}</Link>
                    </TableCell>
                    <TableCell className="max-w-56">
                      <Link href={`/obras/${b.project_id}?tab=pagos`} className="block truncate hover:underline">{p?.name ?? "—"}</Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{clientOf(b) || b.recipient || "—"}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDate(b.issued_on)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{b.price !== null ? money(b.price, b.currency) : "—"}</TableCell>
                    <TableCell><BudgetStatusBadge status={b.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" disabled={busy === b.id || !settings.data} onClick={() => download(b)}>
                        <Download /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (projectId) router.push(`/obras/${projectId}/presupuestos/nuevo`);
            }}
          >
            <DialogHeader>
              <DialogTitle>Nuevo presupuesto</DialogTitle>
              <DialogDescription>Elegí la obra. El presupuesto arranca con la plantilla y los datos de la obra (cliente y padrón).</DialogDescription>
            </DialogHeader>
            <Field label="Obra">
              <SimpleSelect
                value={projectId}
                onChange={setProjectId}
                aria-label="Obra"
                placeholder="Elegí una obra"
                options={openProjects.map((p) => ({ value: p.id, label: `${p.name}${p.client_id && clientName.get(p.client_id) ? ` · ${clientName.get(p.client_id)}` : ""}` }))}
              />
            </Field>
            {openProjects.length === 0 && (
              <p className="text-sm text-muted-foreground">Primero creá la obra en <Link href="/obras/nueva" className="text-primary hover:underline">Obras</Link>.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChoosing(false)}>Cancelar</Button>
              <Button type="submit" disabled={!projectId}>Armar presupuesto</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
