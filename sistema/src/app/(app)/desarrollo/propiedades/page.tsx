"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Home, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { PropertyDialog } from "@/components/dev/dialogs";
import { PropertyStatusBadge } from "@/components/dev/property-status";
import { PROPERTY_KINDS, PROPERTY_STATUS, PROPERTY_STATUS_ORDER } from "@/lib/constants";
import { useDevLeases, useDevPayments, useDevProperties, useDevTenants, useSession } from "@/lib/data/hooks";
import { isLeaseActive, leaseBalance } from "@/lib/dev";
import { formatMoney, matches } from "@/lib/format";
import { can } from "@/lib/permissions";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(
  PROPERTY_STATUS_ORDER.map((s) => ({ value: s, label: PROPERTY_STATUS[s].label })),
);

function PropertiesList() {
  const router = useRouter();
  const search = useSearchParams();
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const properties = useDevProperties();
  const tenants = useDevTenants(admin);
  const leases = useDevLeases(admin);
  const payments = useDevPayments(admin);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(() => {
    const s = search.get("estado");
    return s && s in PROPERTY_STATUS ? s : "";
  });
  const [creating, setCreating] = useState(false);

  const tenantName = new Map((tenants.data ?? []).map((t) => [t.id, t.name]));
  const all = (properties.data ?? []).filter((p) => !p.archived_at);
  const rows = all
    .map((p) => {
      const lease = (leases.data ?? []).find((l) => l.property_id === p.id && isLeaseActive(l));
      return { p, lease, tenant: lease ? tenantName.get(lease.tenant_id) : undefined, balance: lease ? leaseBalance(lease, payments.data ?? []) : null };
    })
    .filter(({ p, tenant }) => (!status || p.status === status) && matches(query, p.name, p.address, p.locality, p.padron, tenant));

  return (
    <>
      <PageHeader
        title="Propiedades"
        description={`${rows.length} de ${all.length} propiedades`}
        actions={admin && <Button onClick={() => setCreating(true)}><Plus /> Nueva propiedad</Button>}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={admin ? "Nombre, dirección, padrón, inquilino…" : "Nombre, dirección, padrón…"} className="pl-8" aria-label="Buscar propiedades" />
        </div>
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_FILTER} placeholder="Todos los estados" className="w-48" aria-label="Filtrar por estado" />
      </div>

      {properties.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando propiedades…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Home} title={all.length ? "Ninguna propiedad coincide con los filtros" : "Todavía no hay propiedades cargadas"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Padrón</TableHead>
                <TableHead>Estado</TableHead>
                {admin && <TableHead className="hidden lg:table-cell">Inquilino</TableHead>}
                {admin && <TableHead className="hidden text-right sm:table-cell">Alquiler</TableHead>}
                {admin && <TableHead className="hidden text-right sm:table-cell">Debe</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ p, lease, tenant, balance }) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-72">
                    <Link href={`/desarrollo/propiedades/${p.id}`} className="block hover:underline">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{[p.address, p.locality].filter(Boolean).join(", ")}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{PROPERTY_KINDS[p.kind]}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.padron || "—"}</TableCell>
                  <TableCell><PropertyStatusBadge status={p.status} /></TableCell>
                  {admin && <TableCell className="hidden text-muted-foreground lg:table-cell">{tenant ?? "—"}</TableCell>}
                  {admin && <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">{lease ? formatMoney(lease.rent_amount, lease.currency) : "—"}</TableCell>}
                  {admin && (
                    <TableCell className="hidden text-right whitespace-nowrap tabular-nums sm:table-cell">
                      {!lease || !balance ? "—" : balance.owed > 0
                        ? <span className="font-medium text-amber-700 dark:text-amber-400">{formatMoney(balance.owed, lease.currency)}</span>
                        : <span className="text-muted-foreground">Al día</span>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {creating && <PropertyDialog onClose={() => setCreating(false)} onSaved={(p) => router.push(`/desarrollo/propiedades/${p.id}`)} />}
    </>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense>
      <PropertiesList />
    </Suspense>
  );
}

