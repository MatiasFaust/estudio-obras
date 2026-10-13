import type { Note, Profile } from "./types";

// Reglas de la interfaz. La base de datos aplica las mismas reglas con RLS
// (supabase/migrations), así que esto solo decide qué botones mostrar.

export const isStaff = (p: Profile | null) => !!p && p.active && (p.role === "admin" || p.role === "arquitecto");
export const isAdmin = (p: Profile | null) => !!p && p.active && p.role === "admin";

export const can = {
  manageProjects: isStaff,
  deleteProjects: isAdmin,
  manageClients: isStaff,
  deleteClients: isAdmin,
  manageStages: isStaff,
  setManualProgress: isStaff,
  viewAllActivity: isStaff,
  manageUsers: isAdmin,
  editNote: (p: Profile | null, note: Note) => !!p && p.active && (note.author_id === p.id || isStaff(p)),
};
