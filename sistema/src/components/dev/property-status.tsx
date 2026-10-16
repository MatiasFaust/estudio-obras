import { PROPERTY_STATUS } from "@/lib/constants";
import type { PropertyStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PropertyStatusDot({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: PROPERTY_STATUS[status].color }}
    />
  );
}

export function PropertyStatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)}>
      <PropertyStatusDot status={status} />
      {PROPERTY_STATUS[status].label}
    </span>
  );
}
