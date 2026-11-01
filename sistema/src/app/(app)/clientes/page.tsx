"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building, Plus, Search, User, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { budgetsOfClient, clientFromBudget, missingClients } from "@/components/clients/budget-clients";
import { ClientDialog } from "@/components/clients/client-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useAction, useBudgets, useClients, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { matches } from "@/lib/format";
import { can } from "@/lib/permissions";

export default function ClientsPage() {
  const { profile } = useSession();
  const repo = useRepo();
  const { run } = useAction();
  const clients = useClients();
  const projects = useProjects();
  const seesBudgets = can.viewFinances(profile);
  const budgets = useBudgets(seesBudgets);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  // Clientes de los presupuestos que todavía no están acá (por ejemplo, los de los PDF ya subidos)
  const missing = useMemo(
    () => (clients.data && budgets.data && can.manageClients(profile) ? missingClients(budgets.data.map((b) => b.client_name), clients.data) : []),
    [clients.data, budgets.data, profile],
  );

  const projectCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects.data ?? []) if (p.client_id) m.set(p.client_id, (m.get(p.client_id) ?? 0) + 1);
    return m;
  }, [projects.data]);

  const list = (clients.data ?? []).filter(
    (c) => (showArchived || !c.archived_at) && matches(query, c.name, c.document, c.email, c.phone, c.address),
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Personas y empresas con las que trabaja el estudio."
        actions={can.manageClients(profile) && (
          <Button onClick={() => setCreating(Date.now())}><Plus /> Nuevo cliente</Button>
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, cédula/RUT, teléfono, correo…" className="pl-8" aria-label="Buscar clientes" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showArchived} onCheckedChange={setShowArchived} /> Mostrar archivados
        </label>
      </div>

      {missing.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm" role="status">
          <span>{missing.length === 1 ? "1 cliente de los presupuestos todavía no está acá." : `${missing.length} clientes de los presupuestos todavía no están acá.`}</span>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}><UserPlus /> {missing.length === 1 ? "Agregarlo" : "Agregarlos"}</Button>
        </div>
      )}

      {clients.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando clientes…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={Users} title={clients.data?.length ? "Ningún cliente coincide con la búsqueda" : "Todavía no hay clientes registrados"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Cédula / RUT</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="hidden lg:table-cell">Dirección</TableHead>
                <TableHead className="text-right">Obras</TableHead>
                {seesBudgets && <TableHead className="text-right">Presupuestos</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} className={c.archived_at ? "opacity-60" : undefined}>
                  <TableCell>
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                      {c.kind === "empresa" ? <Building className="size-4 text-muted-foreground" /> : <User className="size-4 text-muted-foreground" />}
                      {c.name}
                      {c.archived_at && <span className="rounded bg-muted px-1.5 text-[10px] font-normal">Archivado</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{c.document ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{c.phone ?? "—"}</div>
                    {c.email && <div className="text-xs">{c.email}</div>}
                  </TableCell>
                  <TableCell className="hidden max-w-60 truncate text-muted-foreground lg:table-cell">{c.address ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{projectCount.get(c.id) ?? 0}</TableCell>
                  {seesBudgets && <TableCell className="text-right tabular-nums">{budgetsOfClient(c, budgets.data ?? [], projects.data ?? []).length}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creating && <ClientDialog key={creating} open onOpenChange={(o) => !o && setCreating(null)} />}

      <ConfirmDialog
        open={adding}
        onOpenChange={setAdding}
        title="¿Agregar estos clientes?"
        description={
          <>
            Solo se agregan: no se borra ni se cambia nada de lo que ya está cargado. Después podés completar sus datos.
            <span className="mt-2 block max-h-48 overflow-y-auto font-medium text-foreground">{missing.join(", ")}</span>
          </>
        }
        confirmLabel="Agregar"
        destructive={false}
        onConfirm={() => run(async () => {
          for (const name of missing) await repo.createClient(clientFromBudget(name));
        }, missing.length === 1 ? "1 cliente agregado" : `${missing.length} clientes agregados`)}
      />
    </>
  );
}
