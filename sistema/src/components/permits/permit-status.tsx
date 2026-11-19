import type { PermitOffice, PermitTask } from "@/lib/types";

/** Oficina de la Intendencia donde está el expediente (en este orden en los selectores) */
export const PERMIT_OFFICES: Record<PermitOffice, string> = {
  edificaciones: "Edificaciones",
  planeamiento_urbano: "Planeamiento Urbano",
};

/** Lo que falta hacer en el expediente */
export const PERMIT_TASKS: Record<PermitTask, string> = {
  grafico_veraz: "Gráfico veraz",
  levantar_observaciones: "Levantar observaciones",
  inspeccion_final: "Inspección final",
};

export const OFFICE_OPTIONS = Object.entries(PERMIT_OFFICES).map(([value, label]) => ({ value, label }));
export const TASK_OPTIONS = Object.entries(PERMIT_TASKS).map(([value, label]) => ({ value, label }));
