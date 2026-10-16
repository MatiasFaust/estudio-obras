import {
  Banknote, Building2, Home, KeyRound, LayoutDashboard, Lightbulb, Map, Users, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo para administradores del área (información financiera) */
  adminOnly?: boolean;
}

/** Las dos áreas del sistema: el estudio de arquitectura y el de desarrollo (casas en alquiler) */
export type Area = "arquitectura" | "desarrollo";

export const AREAS: Record<Area, { label: string; short: string; home: string; subtitle: string }> = {
  arquitectura: { label: "Estudio de arquitectura", short: "Arquitectura", home: "/", subtitle: "Gestión · Paysandú" },
  desarrollo: { label: "Estudio de desarrollo", short: "Desarrollo", home: "/desarrollo", subtitle: "Casas en alquiler" },
};

export const areaOf = (pathname: string): Area =>
  pathname === "/desarrollo" || pathname.startsWith("/desarrollo/") ? "desarrollo" : "arquitectura";

export const NAV: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa de obras", icon: Map },
  { href: "/obras", label: "Obras", icon: Building2 },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/pagos", label: "Presupuestos", icon: Banknote, adminOnly: true },
  { href: "/ideas", label: "Ideas del estudio", icon: Lightbulb },
];

export const NAV_DEV: NavItem[] = [
  { href: "/desarrollo", label: "Panel", icon: LayoutDashboard },
  { href: "/desarrollo/mapa", label: "Mapa de propiedades", icon: Map },
  { href: "/desarrollo/propiedades", label: "Propiedades", icon: Home },
  { href: "/desarrollo/inquilinos", label: "Inquilinos", icon: Users, adminOnly: true },
  { href: "/desarrollo/cobros", label: "Alquileres y cobros", icon: KeyRound, adminOnly: true },
];

export const isActive = (pathname: string, href: string) =>
  href === "/" || href === "/desarrollo" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
