import type { Currency, NoteCategory, PaymentMethod, ProjectStatus, ProjectType, UserRole } from "./types";

export const CURRENCIES: Record<Currency, string> = {
  UYU: "Pesos uruguayos ($)",
  USD: "Dólares (US$)",
};

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  cheque: "Cheque",
  deposito: "Depósito",
  otro: "Otro",
};

/** Grupos de estado que distingue el mapa y el dashboard */
export type StatusGroup = "planificacion" | "activa" | "pausada" | "finalizada" | "archivada";

export const STATUS: Record<ProjectStatus, { label: string; group: StatusGroup }> = {
  anteproyecto: { label: "Anteproyecto", group: "planificacion" },
  proyecto_ejecutivo: { label: "Proyecto ejecutivo", group: "planificacion" },
  tramites: { label: "Trámites y permisos", group: "planificacion" },
  planificada: { label: "Obra planificada", group: "planificacion" },
  en_construccion: { label: "En construcción", group: "activa" },
  pausada: { label: "Pausada", group: "pausada" },
  finalizada: { label: "Finalizada", group: "finalizada" },
  archivada: { label: "Archivada", group: "archivada" },
};

export const STATUS_ORDER = Object.keys(STATUS) as ProjectStatus[];
/** Estados que se pueden elegir directamente (archivar es una acción aparte) */
export const SELECTABLE_STATUS = STATUS_ORDER.filter((s) => s !== "archivada");

export const STATUS_GROUPS: Record<StatusGroup, { label: string; color: string }> = {
  activa: { label: "Activas", color: "#2f7d4f" },
  planificacion: { label: "En planificación", color: "#c58a17" },
  pausada: { label: "Pausadas", color: "#b5432f" },
  finalizada: { label: "Finalizadas", color: "#3b6ea8" },
  archivada: { label: "Archivadas", color: "#8a8a85" },
};

export const statusColor = (s: ProjectStatus) => STATUS_GROUPS[STATUS[s].group].color;

export const PROJECT_TYPES: Record<ProjectType, string> = {
  vivienda: "Vivienda",
  edificio: "Edificio",
  reforma: "Reforma",
  ampliacion: "Ampliación",
  comercial: "Local comercial",
  industrial: "Industrial",
  institucional: "Institucional",
  otro: "Otro",
};

export const NOTE_CATEGORIES: Record<NoteCategory, { label: string; className: string }> = {
  idea: { label: "Idea", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  observacion: { label: "Observación", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  pendiente: { label: "Pendiente", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  importante: { label: "Importante", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export const ROLES: Record<UserRole, string> = {
  admin: "Administrador",
  arquitecto: "Arquitecto",
  colaborador: "Colaborador",
};

export const DEPARTMENTS = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno", "Flores", "Florida",
  "Lavalleja", "Maldonado", "Montevideo", "Paysandú", "Río Negro", "Rivera", "Rocha",
  "Salto", "San José", "Soriano", "Tacuarembó", "Treinta y Tres",
];

/** Centro inicial del mapa: Paysandú */
export const PAYSANDU_CENTER: [number, number] = [-32.3171, -58.0807];
