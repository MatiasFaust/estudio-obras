import type { Note, Profile } from "./types";

// Reglas de la interfaz. La base de datos aplica las mismas reglas con RLS
// (supabase/migrations), así que esto solo decide qué botones mostrar.

// `arquitectura !== false`: perfiles guardados antes de existir el acceso por área
export const hasArq = (p: Profile | null) => !!p && p.active && p.arquitectura !== false;
export const isStaff = (p: Profile | null) => hasArq(p) && (p!.role === "admin" || p!.role === "arquitecto");
export const isAdmin = (p: Profile | null) => hasArq(p) && p!.role === "admin";

export const isDevMember = (p: Profile | null) => !!p && p.active && !!p.desarrollo;
export const isDevAdmin = (p: Profile | null) => isDevMember(p) && p!.desarrollo === "admin";

export const can = {
  manageProjects: isStaff,
  deleteProjects: isAdmin,
  manageClients: isStaff,
  deleteClients: isAdmin,
  manageStages: isStaff,
  setManualProgress: isStaff,
  viewAllActivity: isStaff,
  manageUsers: isAdmin,
  /** Información financiera (monto acordado y pagos) */
  viewFinances: isAdmin,
  editNote: (p: Profile | null, note: Note) => !!p && p.active && (note.author_id === p.id || isStaff(p)),

  // Estudio de desarrollo
  viewDev: isDevMember,
  /** Propiedades, inquilinos, contratos y cobros */
  manageDev: isDevAdmin,
};
