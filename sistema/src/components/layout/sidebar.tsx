"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/common/brand";
import { DEV_ROLES, ROLES } from "@/lib/constants";
import { useSession } from "@/lib/data/hooks";
import { initials } from "@/lib/format";
import { can, hasArq, isDevMember } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { AREAS, areaOf, isActive, NAV, NAV_DEV, type Area } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile } = useSession();
  const area = areaOf(pathname);
  const items = area === "desarrollo"
    ? NAV_DEV.filter((item) => !item.adminOnly || can.manageDev(profile))
    : NAV.filter((item) => !item.adminOnly || can.viewFinances(profile));
  return (
    <nav className="grid gap-0.5" aria-label="Navegación principal">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-muted hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Botones para pasar de un estudio al otro (solo si el usuario tiene acceso a los dos) */
export function AreaSwitch({ className }: { className?: string }) {
  const pathname = usePathname();
  const { profile } = useSession();
  if (!hasArq(profile) || !isDevMember(profile)) return null;
  const current = areaOf(pathname);
  return (
    <nav aria-label="Área" className={cn("inline-flex shrink-0 rounded-lg border bg-muted/50 p-0.5", className)}>
      {(Object.keys(AREAS) as Area[]).map((a) => (
        <Link
          key={a}
          href={AREAS[a].home}
          aria-current={a === current ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm",
            a === current ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="sm:hidden">{AREAS[a].short}</span>
          <span className="hidden sm:inline">{AREAS[a].label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SidebarUser() {
  const pathname = usePathname();
  const { profile } = useSession();
  if (!profile) return null;
  const role = areaOf(pathname) === "desarrollo" && profile.desarrollo ? DEV_ROLES[profile.desarrollo] : ROLES[profile.role];
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {initials(profile.full_name || profile.email)}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-medium">{profile.full_name || profile.email}</div>
        <div className="text-xs text-muted-foreground">{role}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="px-4 pt-5 pb-6">
        <Brand subtitle={AREAS[areaOf(pathname)].subtitle} logo={AREAS[areaOf(pathname)].logo} />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <SidebarNav />
      </div>
      <div className="border-t p-3">
        <SidebarUser />
      </div>
    </aside>
  );
}
