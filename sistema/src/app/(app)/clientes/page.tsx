"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building, Plus, Search, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientDialog } from "@/components/clients/client-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { useClients, useProjects, useSession } from "@/lib/data/hooks";
import { matches } from "@/lib/format";
import { can } from "@/lib/permissions";

export default function ClientsPage() {
  const { profile } = useSession();
  const clients = useClients();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState<number | null>(null);

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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creating && <ClientDialog key={creating} open onOpenChange={(o) => !o && setCreating(null)} />}
    </>
  );
}
