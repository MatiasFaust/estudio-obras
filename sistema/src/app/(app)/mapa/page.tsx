"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MapPinOff, MapPinPlus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusDot } from "@/components/common/status-badge";
import { ProjectsMap } from "@/components/map";
import { STATUS, STATUS_GROUPS, type StatusGroup } from "@/lib/constants";
import { useClients, useProjects, useSession } from "@/lib/data/hooks";
import { matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const GROUPS: StatusGroup[] = ["activa", "planificacion", "pausada", "finalizada"];

export default function MapPage() {
  const router = useRouter();
  const { profile } = useSession();
  const projects = useProjects();
  const clients = useClients();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<StatusGroup[]>(GROUPS);
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const clientName = useMemo(() => new Map((clients.data ?? []).map((c) => [c.id, c.name])), [clients.data]);

  const visible = (projects.data ?? []).filter((p) => {
    const g = STATUS[p.status].group;
    return (
      (g === "archivada" ? showArchived : groups.includes(g)) &&
      matches(query, p.name, p.code, p.address, p.locality, p.padron, p.client_id ? clientName.get(p.client_id) : "")
    );
  });
  const located = visible.filter((p) => p.lat !== null && p.lng !== null);
  const fitKey = `${groups.join()}|${showArchived}|${query}|${projects.dataUpdatedAt ? "ok" : ""}`;

  const toggleGroup = (g: StatusGroup) =>
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  return (
    <div className="-mx-4 -my-5 grid h-[calc(100dvh-3.5rem)] min-h-[520px] grid-rows-[minmax(0,1fr)_minmax(0,45%)] sm:-mx-6 lg:-mx-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="order-2 flex min-h-0 flex-col border-t bg-card lg:order-1 lg:border-t-0 lg:border-r">
        <div className="grid gap-2.5 border-b p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Mapa de obras</h1>
            <span className="text-xs text-muted-foreground">{located.length} en el mapa</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o dirección…" className="pl-8" aria-label="Buscar en el mapa" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {GROUPS.map((g) => {
              const on = groups.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGroup(g)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    on ? "border-foreground/25 bg-background" : "border-transparent bg-muted text-muted-foreground line-through",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_GROUPS[g].color }} />
                  {STATUS_GROUPS[g].label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={showArchived} onCheckedChange={setShowArchived} /> Incluir archivadas
          </label>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Ninguna obra con estos filtros.</li>}
          {visible.map((p) => {
            const noLocation = p.lat === null || p.lng === null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (noLocation ? router.push(`/obras/${p.id}`) : setSelected(p.id))}
                  className={cn(
                    "grid w-full gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
                    selected === p.id && "bg-accent hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <StatusDot status={p.status} />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </span>
                  <span className="truncate pl-4 text-xs text-muted-foreground">
                    {p.address} · {p.client_id ? clientName.get(p.client_id) : "sin cliente"}
                  </span>
                  {noLocation ? (
                    <span className="flex items-center gap-1 pl-4 text-xs text-amber-700 dark:text-amber-400"><MapPinOff className="size-3" /> Sin ubicación</span>
                  ) : (
                    <ProgressBar value={p.progress} className="pl-4" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className={cn("relative order-1 isolate min-h-0 lg:order-2", adding && "[&_.leaflet-container]:cursor-crosshair")}>
        <ProjectsMap
          projects={located}
          clients={clients.data ?? []}
          selectedId={selected}
          onSelect={setSelected}
          fitKey={fitKey}
          onMapClick={(pt) => {
            if (adding) router.push(`/obras/nueva?lat=${pt.lat.toFixed(6)}&lng=${pt.lng.toFixed(6)}`);
          }}
          className="h-full w-full"
        />
        {can.manageProjects(profile) && (
          <div className="absolute top-3 right-3 z-[500] flex items-center gap-2">
            {adding && (
              <span className="rounded-full bg-foreground px-3 py-1 text-xs text-background shadow">Tocá el punto donde está la obra</span>
            )}
            <Button size="sm" variant={adding ? "outline" : "default"} className="shadow" onClick={() => setAdding((a) => !a)}>
              {adding ? <><X /> Cancelar</> : <><MapPinPlus /> Agregar obra en el mapa</>}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
