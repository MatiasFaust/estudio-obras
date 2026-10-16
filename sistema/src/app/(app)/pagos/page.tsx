"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Banknote, Lock, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SimpleSelect } from "@/components/common/simple-select";
import { StatusBadge } from "@/components/common/status-badge";
import { summarize } from "@/components/payments/summary";
import { SELECTABLE_STATUS, STATUS } from "@/lib/constants";
import { useClients, useFinances, usePayments, useProfiles, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, matches } from "@/lib/format";
import { can } from "@/lib/permissions";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(SELECTABLE_STATUS.map((s) => ({ value: s, label: STATUS[s].label })));

/** Listado de presupuestos: los montos se ven al entrar a cada obra (pestaña Pagos) */
export default function BudgetsPage() {
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const projects = useProjects();
  const clients = useClients();
  const profiles = useProfiles();
  const finances = useFinances(allowed);
  const payments = usePayments(allowed);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [responsible, setResponsible] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);
  const personName = useMemo(() => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])), [profiles.data]);
  const responsibleFilter = [{ value: "", label: "Todos los responsables" }].concat(
    (profiles.data ?? []).filter((p) => p.role !== "colaborador").map((p) => ({ value: p.id, label: p.full_name })),
  );

  if (!allowed) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Los presupuestos son solo para administradores." />;
  }

  const all = (projects.data ?? [])
    .map((p) => {
      const own = (payments.data ?? []).filter((x) => x.project_id === p.id);
      const finance = finances.data?.find((f) => f.project_id === p.id);
      return { project: p, summary: summarize(finance, own), hasData: !!finance || own.length > 0 };
    })
    .filter((r) => r.hasData || r.project.status !== "archivada");

  const rows = all
    .filter(({ project: p, summary: s }) =>
      (!status || p.status === status) &&
      (!responsible || p.responsible_id === responsible) &&
      (!onlyPending || (s.balance ?? 0) > 0) &&
      matches(query, p.name, p.code, p.address, p.locality, p.padron, p.client_id ? clientName.get(p.client_id) : ""),
    )
    .sort((a, b) => b.project.created_at.localeCompare(a.project.created_at));

  return (
    <>
      <PageHeader title="Presupuestos" description={`${rows.length} de ${all.length} obras · tocá una obra para ver su presupuesto y pagos`} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, padrón, dirección, cliente…" className="pl-8" aria-label="Buscar obras" />
        </div>
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_FILTER} className="w-44" aria-label="Filtrar por estado" />
        <SimpleSelect value={responsible} onChange={setResponsible} options={responsibleFilter} className="w-48" aria-label="Filtrar por responsable" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={onlyPending} onCheckedChange={setOnlyPending} /> Solo con saldo pendiente
        </label>
      </div>

      {projects.isLoading || finances.isLoading || payments.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando presupuestos…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Banknote} title={all.length ? "Ninguna obra coincide con los filtros" : "Todavía no hay obras registradas"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="hidden md:table-cell">Padrón</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Responsable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ project: p }) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-72">
                    <Link href={`/obras/${p.id}?tab=pagos`} className="block hover:underline">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">Creada el {formatDate(p.created_at)}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.padron || "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.client_id ? clientName.get(p.client_id) ?? "—" : "—"}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{p.responsible_id ? personName.get(p.responsible_id) ?? "—" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
