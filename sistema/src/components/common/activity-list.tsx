"use client";

import { Building2, History, Layers, StickyNote, User } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { useActivity } from "@/lib/data/hooks";
import { formatDateTime, timeAgo } from "@/lib/format";

const ICONS: Record<string, typeof History> = {
  project: Building2,
  stage: Layers,
  note: StickyNote,
  client: User,
};

/** Historial de cambios registrados por la base de datos */
export function ActivityList({ projectId, limit = 30, compact }: { projectId?: string; limit?: number; compact?: boolean }) {
  const activity = useActivity(projectId, limit);

  if (activity.isLoading) return <p className="text-sm text-muted-foreground">Cargando actividad…</p>;
  if (!activity.data?.length) return <EmptyState icon={History} title="Sin actividad registrada" className={compact ? "py-6" : undefined} />;

  return (
    <ol className="grid gap-0.5">
      {activity.data.map((a) => {
        const Icon = ICONS[a.entity_type] ?? History;
        return (
          <li key={a.id} className="flex gap-3 rounded-lg px-1 py-1.5">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-muted">
              <Icon className="size-3.5 text-muted-foreground" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="leading-snug">
                <span className="font-medium">{a.actor_name ?? "Sistema"}</span>{" "}
                <span className="text-muted-foreground">{a.summary}</span>
              </p>
              <p className="text-xs text-muted-foreground" title={formatDateTime(a.created_at)}>{timeAgo(a.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
