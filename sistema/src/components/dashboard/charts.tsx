import { PROJECT_TYPES, STATUS, STATUS_GROUPS, type StatusGroup } from "@/lib/constants";
import type { Project, ProjectType } from "@/lib/types";

/** Barra apilada con la distribución de obras por grupo de estado */
export function StatusDistribution({ projects }: { projects: Project[] }) {
  const groups: StatusGroup[] = ["activa", "planificacion", "pausada", "finalizada"];
  const counts = groups.map((g) => ({ g, n: projects.filter((p) => STATUS[p.status].group === g).length }));
  const total = counts.reduce((a, c) => a + c.n, 0);

  if (!total) return <p className="text-sm text-muted-foreground">Sin obras registradas.</p>;

  return (
    <div className="grid gap-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img"
        aria-label={counts.map((c) => `${STATUS_GROUPS[c.g].label}: ${c.n}`).join(", ")}>
        {counts.filter((c) => c.n).map((c) => (
          <div key={c.g} style={{ width: `${(c.n / total) * 100}%`, backgroundColor: STATUS_GROUPS[c.g].color }} />
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {counts.map((c) => (
          <li key={c.g} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ backgroundColor: STATUS_GROUPS[c.g].color }} />
            <span className="text-muted-foreground">{STATUS_GROUPS[c.g].label}</span>
            <span className="ml-auto font-medium tabular-nums">{c.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales: cantidad de obras por tipo */
export function TypeBars({ projects }: { projects: Project[] }) {
  const counts = new Map<ProjectType, number>();
  for (const p of projects) counts.set(p.project_type, (counts.get(p.project_type) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));

  if (!rows.length) return <p className="text-sm text-muted-foreground">Sin datos.</p>;

  return (
    <ul className="grid gap-2">
      {rows.map(([type, n]) => (
        <li key={type} className="grid grid-cols-[110px_1fr_24px] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground">{PROJECT_TYPES[type]}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary/80" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}
