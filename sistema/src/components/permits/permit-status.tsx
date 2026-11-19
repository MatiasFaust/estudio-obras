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
  terminado: "Terminado",
};

/** Código de colores de la lista de Julia: rojo los terminados (archivados), amarillo los de inspección final */
export const TASK_ROW_COLOR: Partial<Record<PermitTask, { row: string; swatch: string; label: string }>> = {
  terminado: { row: "bg-red-500/15 hover:bg-red-500/20", swatch: "bg-red-500/40", label: "Terminado (archivado)" },
  inspeccion_final: { row: "bg-yellow-400/25 hover:bg-yellow-400/35", swatch: "bg-yellow-400/60", label: "Inspección final" },
};

export const OFFICE_OPTIONS = Object.entries(PERMIT_OFFICES).map(([value, label]) => ({ value, label }));
export const TASK_OPTIONS = Object.entries(PERMIT_TASKS).map(([value, label]) => ({ value, label }));
