import { Building2, LayoutDashboard, Lightbulb, Map, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa de obras", icon: Map },
  { href: "/obras", label: "Obras", icon: Building2 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/ideas", label: "Ideas del estudio", icon: Lightbulb },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
