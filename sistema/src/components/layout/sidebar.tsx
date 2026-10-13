"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/common/brand";
import { ROLES } from "@/lib/constants";
import { useSession } from "@/lib/data/hooks";
import { initials } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { profile } = useSession();
  return (
    <nav className="grid gap-0.5" aria-label="Navegación principal">
      {NAV.filter((item) => !item.adminOnly || can.viewFinances(profile)).map(({ href, label, icon: Icon }) => {
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

export function SidebarUser() {
  const { profile } = useSession();
  if (!profile) return null;
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {initials(profile.full_name || profile.email)}
      </span>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-medium">{profile.full_name || profile.email}</div>
        <div className="text-xs text-muted-foreground">{ROLES[profile.role]}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="px-4 pt-5 pb-6">
        <Brand />
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
