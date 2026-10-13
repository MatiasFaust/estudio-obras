import { cn } from "@/lib/utils";

export function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="relative size-6 shrink-0 border-2 border-foreground" aria-hidden>
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 bg-primary" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.16em] uppercase">Estudio</div>
          <div className="text-[11px] text-muted-foreground">Gestión · Paysandú</div>
        </div>
      )}
    </div>
  );
}
