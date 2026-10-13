import { STATUS, statusColor } from "@/lib/constants";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatusDot({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: statusColor(status) }}
    />
  );
}

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      <StatusDot status={status} />
      {STATUS[status].label}
    </span>
  );
}
