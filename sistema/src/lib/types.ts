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
  /** Acceso al estudio de arquitectura (con el rol de arriba) */
  arquitectura: boolean;
  /** Acceso al estudio de desarrollo (null = sin acceso) */
  desarrollo: DevRole | null;
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

export type Currency = "UYU" | "USD";
export type PaymentMethod = "transferencia" | "efectivo" | "cheque" | "deposito" | "otro";

/** Monto acordado de una obra (solo administradores) */
export interface Finance {
  project_id: string;
  agreed_amount: number | null;
  currency: Currency;
  notes: string | null;
  updated_at: string;
}

export interface Payment {
  id: string;
  project_id: string;
  paid_on: string;
  amount: number;
  currency: Currency;
  exchange_rate: number | null;
  /** Monto en la moneda acordada de la obra */
  amount_contract: number;
  concept: string;
  method: PaymentMethod;
  receipt: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Entradas de formularios ----

export interface FinanceInput {
  agreed_amount: number | null;
  currency: Currency;
  notes: string | null;
}

export interface PaymentInput {
  project_id: string;
  paid_on: string;
  amount: number;
  currency: Currency;
  exchange_rate: number | null;
  concept: string;
  method: PaymentMethod;
  receipt: string | null;
  notes: string | null;
}

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

// ---- Estudio de desarrollo (casas y terrenos propios en alquiler) ----

export type DevRole = "admin" | "colaborador";
export type PropertyKind = "casa" | "apartamento" | "terreno" | "local" | "otro";
export type PropertyStatus = "alquilada" | "desocupada" | "en_construccion" | "terreno_baldio" | "alquiler_por_dia";

export interface DevProperty {
  id: string;
  name: string;
  kind: PropertyKind;
  status: PropertyStatus;
  address: string;
  locality: string;
  department: string;
  padron: string | null;
  lat: number | null;
  lng: number | null;
  bedrooms: number | null;
  area_m2: number | null;
  notes: string | null;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DevTenant {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Contrato de alquiler (solo administradores de desarrollo) */
export interface DevLease {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string | null;
  terminated_on: string | null;
  rent_amount: number;
  currency: Currency;
  /** Día del mes en que vence el alquiler */
  due_day: number;
  deposit: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Cobro de un mes de alquiler, en la moneda del contrato */
export interface DevRentPayment {
  id: string;
  lease_id: string;
  /** Mes que se paga: AAAA-MM-01 */
  period: string;
  paid_on: string;
  amount: number;
  method: PaymentMethod;
  receipt: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DevPropertyInput = Omit<DevProperty, "id" | "archived_at" | "created_by" | "created_at" | "updated_at">;
export type DevTenantInput = Omit<DevTenant, "id" | "created_by" | "created_at" | "updated_at">;
export type DevLeaseInput = Omit<DevLease, "id" | "created_by" | "created_at" | "updated_at">;
export type DevRentPaymentInput = Omit<DevRentPayment, "id" | "created_by" | "created_at" | "updated_at">;
