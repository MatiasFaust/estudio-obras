import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({
  className,
  compact,
  subtitle = "Gestión · Paysandú",
  logo,
}: {
  className?: string;
  compact?: boolean;
  subtitle?: string;
  /** Logo redondo del estudio (en /public/logos) */
  logo?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {logo ? (
        <Image src={logo} alt="" width={32} height={32} unoptimized loading="eager" className="size-8 shrink-0 rounded-full" />
      ) : (
        <span className="relative size-6 shrink-0 border-2 border-foreground" aria-hidden>
          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 bg-primary" />
        </span>
      )}
      {!compact && (
        <div className="leading-tight">
          <div className="text-[13px] font-semibold tracking-[0.16em] uppercase">Estudio</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      )}
    </div>
  );
}
