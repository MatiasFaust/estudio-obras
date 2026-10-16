"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { TenantDialog } from "@/components/dev/dialogs";
import { useAction, useDevLeases, useDevPayments, useDevProperties, useDevTenants, useRepo, useSession } from "@/lib/data/hooks";
import { isLeaseActive, leaseBalance } from "@/lib/dev";
import { formatMoney, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { DevTenant } from "@/lib/types";

export default function TenantsPage() {
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const repo = useRepo();
  const { run } = useAction();
  const tenants = useDevTenants(admin);
  const properties = useDevProperties();
  const leases = useDevLeases(admin);
  const payments = useDevPayments(admin);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<DevTenant | "new" | null>(null);
  const [deleting, setDeleting] = useState<DevTenant | null>(null);

  if (!admin) return <EmptyState icon={Lock} title="Sin permiso" description="Los datos de inquilinos son solo para administradores." />;

  const propName = new Map((properties.data ?? []).map((p) => [p.id, p.name]));
  const rows = (tenants.data ?? [])
    .map((t) => {
      const own = (leases.data ?? []).filter((l) => l.tenant_id === t.id);
      const active = own.find((l) => isLeaseActive(l));
      return { t, active, hasLeases: own.length > 0, balance: active ? leaseBalance(active, payments.data ?? []) : null };
    })
    .filter(({ t, active }) => matches(query, t.name, t.document, t.phone, t.email, active ? propName.get(active.property_id) : ""));

  return (
    <>
      <PageHeader
        title="Inquilinos"
        description={`${rows.length} de ${(tenants.data ?? []).length} inquilinos`}
        actions={<Button onClick={() => setEditing("new")}><Plus /> Nuevo inquilino</Button>}
      />
      <div className="mb-3 relative w-full sm:w-72">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, teléfono, casa…" className="pl-8" aria-label="Buscar inquilinos" />
      </div>

      {tenants.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando inquilinos…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={(tenants.data ?? []).length ? "Ningún inquilino coincide con la búsqueda" : "Todavía no hay inquilinos cargados"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead className="hidden md:table-cell">Contacto</TableHead>
                <TableHead>Alquila</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Debe</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ t, active, hasLeases, balance }) => (
                <TableRow key={t.id}>
                  <TableCell className="max-w-64">
                    <span className="block truncate font-medium">{t.name}</span>
                    {t.document && <span className="block text-xs text-muted-foreground">CI {t.document}</span>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{[t.phone, t.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell>
                    {active
                      ? <Link href={`/desarrollo/propiedades/${active.property_id}`} className="text-primary hover:underline">{propName.get(active.property_id) ?? "—"}</Link>
                      : <span className="text-muted-foreground">Sin contrato vigente</span>}
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                    {!active || !balance ? "—" : balance.owed > 0
                      ? <span className="font-medium text-amber-700 dark:text-amber-400">{formatMoney(balance.owed, active.currency)}</span>
                      : <span className="text-muted-foreground">Al día</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon-sm" variant="ghost" aria-label={`Editar ${t.name}`} onClick={() => setEditing(t)}><Pencil /></Button>
                    {!hasLeases && <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${t.name}`} onClick={() => setDeleting(t)}><Trash2 /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && <TenantDialog tenant={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar el inquilino?"
        description={<>Se borra <strong>{deleting?.name}</strong>. Esta acción no se puede deshacer.</>}
        onConfirm={() => run(() => repo.deleteDevTenant(deleting!.id), "Inquilino eliminado")}
      />
    </>
  );
}
