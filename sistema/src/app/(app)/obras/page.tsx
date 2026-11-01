"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, ListPlus, MapPin, Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { proposeObras } from "@/components/budgets/obras-from-budgets";
import { ObrasFromBudgetsDialog } from "@/components/budgets/obras-from-budgets-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LocateObrasDialog } from "@/components/map/locate-obras-dialog";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SimpleSelect } from "@/components/common/simple-select";
import { StatusBadge } from "@/components/common/status-badge";
import { PROJECT_TYPES, SELECTABLE_STATUS, STATUS } from "@/lib/constants";
import { useBudgets, useClients, useFinances, usePayments, useProfiles, useProjects, useSession } from "@/lib/data/hooks";
import { formatDate, isOverdue, matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const STATUS_FILTER = [{ value: "", label: "Todos los estados" }].concat(SELECTABLE_STATUS.map((s) => ({ value: s, label: STATUS[s].label })));
const TYPE_FILTER = [{ value: "", label: "Todos los tipos" }].concat(Object.entries(PROJECT_TYPES).map(([value, label]) => ({ value, label })));

export default function ProjectsPage() {
  const { profile } = useSession();
  const projects = useProjects();
  const clients = useClients();
  const profiles = useProfiles();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [responsible, setResponsible] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const canPropose = can.viewFinances(profile) && can.manageProjects(profile);
  const budgets = useBudgets(canPropose);
  const finances = useFinances(canPropose);
  const payments = usePayments(canPropose);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [locating, setLocating] = useState<number | null>(null);

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);
  const personName = useMemo(() => new Map((profiles.data ?? []).map((p) => [p.id, p.full_name])), [profiles.data]);
  const responsibleFilter = [{ value: "", label: "Todos los responsables" }].concat(
    (profiles.data ?? []).filter((p) => p.role !== "colaborador").map((p) => ({ value: p.id, label: p.full_name })),
  );

  // Obras que faltan según los presupuestos y los clientes (cuando ya cargó todo, para no proponer de más)
  const proposals = useMemo(
    () => (canPropose && budgets.data && projects.data && clients.data && finances.data && payments.data && profiles.data
      ? proposeObras({ budgets: budgets.data, projects: projects.data, clients: clients.data, finances: finances.data, payments: payments.data, profiles: profiles.data })
      : []),
    [canPropose, budgets.data, projects.data, clients.data, finances.data, payments.data, profiles.data],
  );
  const suggested = proposals.filter((p) => p.suggested).length;
  const unlocated = (projects.data ?? []).filter((p) => p.lat === null);

  const list = (projects.data ?? []).filter(
    (p) =>
      (showArchived ? true : p.status !== "archivada") &&
      (!status || p.status === status) &&
      (!type || p.project_type === type) &&
      (!responsible || p.responsible_id === responsible) &&
      matches(query, p.name, p.code, p.address, p.locality, p.padron, p.client_id ? clientName.get(p.client_id) : ""),
  );

  return (
    <>
      <PageHeader
        title="Obras y proyectos"
        description={`${list.length} de ${(projects.data ?? []).length} registros`}
        actions={can.manageProjects(profile) && (
          <Link href="/obras/nueva" className={buttonVariants()}><Plus /> Nueva obra</Link>
        )}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, código, dirección, cliente…" className="pl-8" aria-label="Buscar obras" />
        </div>
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_FILTER} placeholder="Todos los estados" className="w-44" aria-label="Filtrar por estado" />
        <SimpleSelect value={type} onChange={setType} options={TYPE_FILTER} placeholder="Todos los tipos" className="w-40" aria-label="Filtrar por tipo" />
        <SimpleSelect value={responsible} onChange={setResponsible} options={responsibleFilter} placeholder="Todos los responsables" className="w-48" aria-label="Filtrar por responsable" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showArchived} onCheckedChange={setShowArchived} /> Archivadas
        </label>
      </div>

      {suggested > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm" role="status">
          <span>{suggested === 1 ? "Hay 1 obra para agregar desde los presupuestos y clientes." : `Hay ${suggested} obras para agregar desde los presupuestos y clientes.`}</span>
          <Button size="sm" variant="outline" onClick={() => setReviewing(Date.now())}><ListPlus /> Revisar y agregar</Button>
        </div>
      )}
      {reviewing && <ObrasFromBudgetsDialog key={reviewing} proposals={proposals} onClose={() => setReviewing(null)} />}

      {can.manageProjects(profile) && unlocated.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3 text-sm" data-notice="sin-ubicacion">
          <span>{unlocated.length === 1 ? "1 obra no tiene ubicación en el mapa." : `${unlocated.length} obras no tienen ubicación en el mapa.`}</span>
          <Button size="sm" variant="outline" onClick={() => setLocating(Date.now())}><MapPin /> Ubicar por padrón</Button>
        </div>
      )}
      {locating && <LocateObrasDialog key={locating} projects={unlocated} onClose={() => setLocating(null)} />}

      {projects.isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Cargando obras…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={Building2} title={(projects.data ?? []).length ? "Ninguna obra coincide con los filtros" : "Todavía no hay obras registradas"} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obra</TableHead>
                <TableHead className="hidden md:table-cell">Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden w-40 sm:table-cell">Avance</TableHead>
                <TableHead className="hidden lg:table-cell">Responsable</TableHead>
                <TableHead className="hidden md:table-cell">Fin previsto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const late = isOverdue(p.due_date) && !["finalizada", "archivada"].includes(p.status);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-72">
                      <Link href={`/obras/${p.id}`} className="block hover:underline">
                        <span className="block truncate font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.code} · {p.address}, {p.locality}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{p.client_id ? clientName.get(p.client_id) ?? "—" : "—"}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="hidden sm:table-cell"><ProgressBar value={p.progress} /></TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{p.responsible_id ? personName.get(p.responsible_id) ?? "—" : "—"}</TableCell>
                    <TableCell className={cn("hidden md:table-cell", late ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {formatDate(p.due_date)}{late && " · vencida"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
