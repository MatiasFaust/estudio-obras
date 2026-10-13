export type UserRole = "admin" | "arquitecto" | "colaborador";

export type ProjectStatus =
  | "anteproyecto"
  | "proyecto_ejecutivo"
  | "tramites"
  | "planificada"
  | "en_construccion"
  | "pausada"
  | "finalizada"
  | "archivada";

export type ProjectType =
  | "vivienda"
  | "edificio"
  | "reforma"
  | "ampliacion"
  | "comercial"
  | "industrial"
  | "institucional"
  | "otro";

export type NoteCategory = "idea" | "observacion" | "pendiente" | "importante";
export type ClientKind = "persona" | "empresa";
export type ProgressMode = "etapas" | "manual";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  kind: ClientKind;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  address: string;
  locality: string;
  department: string;
  padron: string | null;
  lat: number | null;
  lng: number | null;
  project_type: ProjectType;
  description: string | null;
  responsible_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: ProjectStatus;
  status_before_archive: ProjectStatus | null;
  progress_mode: ProgressMode;
  manual_progress: number | null;
  progress: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Stage {
  id: string;
  project_id: string;
  name: string;
  position: number;
  weight: number;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Documento de Tiptap (JSON) */
export type RichText = Record<string, unknown>;

export interface Note {
  id: string;
  project_id: string | null;
  title: string;
  content: RichText;
  content_text: string;
  category: NoteCategory;
  resolved_at: string | null;
  resolved_by: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  entity_type: "client" | "project" | "stage" | "note" | string;
  entity_id: string | null;
  project_id: string | null;
  action: string;
  summary: string;
  created_at: string;
}

// ---- Entradas de formularios ----

export interface ClientInput {
  kind: ClientKind;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

export interface ProjectInput {
  name: string;
  client_id: string | null;
  address: string;
  locality: string;
  department: string;
  padron: string | null;
  lat: number | null;
  lng: number | null;
  project_type: ProjectType;
  description: string | null;
  responsible_id: string | null;
  start_date: string | null;
  due_date: string | null;
  status: ProjectStatus;
}

export interface StageInput {
  name: string;
  weight: number;
  progress: number;
  start_date: string | null;
  due_date: string | null;
}

export interface NoteInput {
  project_id: string | null;
  title: string;
  content: RichText;
  content_text: string;
  category: NoteCategory;
}
