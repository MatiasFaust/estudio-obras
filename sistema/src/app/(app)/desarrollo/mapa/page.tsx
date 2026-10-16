"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { MapPinOff, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PropertyStatusDot } from "@/components/dev/property-status";
import { PropertiesMap } from "@/components/map";
import { PROPERTY_STATUS, PROPERTY_STATUS_ORDER } from "@/lib/constants";
import { useDevLeases, useDevProperties, useDevTenants, useSession } from "@/lib/data/hooks";
import { isLeaseActive } from "@/lib/dev";
import { matches } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { PropertyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function DevMapPage() {
  const router = useRouter();
  const { profile } = useSession();
  const admin = can.manageDev(profile);
  const properties = useDevProperties();
  const tenants = useDevTenants(admin);
  const leases = useDevLeases(admin);
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<PropertyStatus[]>(PROPERTY_STATUS_ORDER);
  const [selected, setSelected] = useState<string | null>(null);

  // Inquilino actual de cada casa (solo administradores)
  const tenantOf = useMemo(() => {
    const name = new Map((tenants.data ?? []).map((t) => [t.id, t.name]));
    const out: Record<string, string> = {};
    for (const l of (leases.data ?? []).filter((x) => isLeaseActive(x))) {
      const n = name.get(l.tenant_id);
      if (n) out[l.property_id] = `Inquilino: ${n}`;
    }
    return out;
  }, [tenants.data, leases.data]);

  const all = (properties.data ?? []).filter((p) => !p.archived_at);
  const visible = all.filter(
    (p) => statuses.includes(p.status) && matches(query, p.name, p.address, p.locality, p.padron, tenantOf[p.id]),
  );
  const located = visible.filter((p) => p.lat !== null && p.lng !== null);
  const fitKey = `${statuses.join()}|${query}|${properties.dataUpdatedAt ? "ok" : ""}`;
  const toggle = (s: PropertyStatus) => setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <div className="-mx-4 -my-5 grid h-[calc(100dvh-3.5rem)] min-h-[520px] grid-rows-[minmax(0,1fr)_minmax(0,45%)] sm:-mx-6 lg:-mx-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="order-2 flex min-h-0 flex-col border-t bg-card lg:order-1 lg:border-t-0 lg:border-r">
        <div className="grid gap-2.5 border-b p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Mapa de propiedades</h1>
            <span className="text-xs text-muted-foreground">{located.length} en el mapa</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o dirección…" className="pl-8" aria-label="Buscar en el mapa" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
            {PROPERTY_STATUS_ORDER.map((s) => {
              const on = statuses.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    on ? "border-foreground/25 bg-background" : "border-transparent bg-muted text-muted-foreground line-through",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: PROPERTY_STATUS[s].color }} />
                  {PROPERTY_STATUS[s].label} ({all.filter((p) => p.status === s).length})
                </button>
              );
            })}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {visible.length === 0 && (
            <li className="p-4 text-center text-sm text-muted-foreground">
              {all.length ? "Ninguna propiedad con estos filtros." : "Todavía no hay propiedades cargadas."}
            </li>
          )}
          {visible.map((p) => {
            const noLocation = p.lat === null || p.lng === null;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => (noLocation ? router.push(`/desarrollo/propiedades/${p.id}`) : setSelected(p.id))}
                  className={cn(
                    "grid w-full gap-1 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
                    selected === p.id && "bg-accent hover:bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <PropertyStatusDot status={p.status} />
                    <span className="truncate text-sm font-medium">{p.name}</span>
                  </span>
                  <span className="truncate pl-4 text-xs text-muted-foreground">
                    {[p.address, p.locality].filter(Boolean).join(", ")}{tenantOf[p.id] ? ` · ${tenantOf[p.id].replace("Inquilino: ", "")}` : ""}
                  </span>
                  {noLocation && (
                    <span className="flex items-center gap-1 pl-4 text-xs text-amber-700 dark:text-amber-400"><MapPinOff className="size-3" /> Sin ubicación</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="relative order-1 isolate min-h-0 lg:order-2">
        <PropertiesMap properties={located} extra={tenantOf} selectedId={selected} onSelect={setSelected} fitKey={fitKey} className="h-full w-full" />
      </div>
    </div>
  );
}
