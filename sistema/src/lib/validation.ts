import { z } from "zod";
import { SELECTABLE_STATUS, PROJECT_TYPES, NOTE_CATEGORIES } from "./constants";
import type { NoteCategory, ProjectStatus, ProjectType } from "./types";

/** Valida el dígito verificador de una cédula de identidad uruguaya (ej. 1.234.567-2) */
export function isValidCI(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 8) return false;
  const padded = digits.padStart(8, "0");
  const factors = [2, 9, 8, 7, 6, 3, 4];
  const sum = factors.reduce((acc, f, i) => acc + f * Number(padded[i]), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(padded[7]);
}

/** RUT uruguayo: 12 dígitos con dígito verificador módulo 11 */
export function isValidRUT(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  const factors = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const sum = factors.reduce((acc, f, i) => acc + f * Number(digits[i]), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(digits[11]);
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres`);

export const clientSchema = z
  .object({
    kind: z.enum(["persona", "empresa"]),
    name: z.string().trim().min(2, "Ingresá el nombre (mínimo 2 caracteres)").max(160),
    document: optionalText(20),
    phone: optionalText(40).regex(/^[0-9+()\s-]*$/, "Solo números, espacios y + ( ) -"),
    email: z.union([z.literal(""), z.string().trim().email("Correo no válido")]),
    address: optionalText(200),
    notes: optionalText(4000),
  })
  .superRefine((v, ctx) => {
    if (!v.document) return;
    if (v.kind === "persona" && !isValidCI(v.document)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "Cédula no válida (revisá el dígito verificador)" });
    }
    if (v.kind === "empresa" && !isValidRUT(v.document)) {
      ctx.addIssue({ code: "custom", path: ["document"], message: "RUT no válido (12 dígitos)" });
    }
  });

export type ClientFormValues = z.infer<typeof clientSchema>;

const dateString = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida")]);

export const projectSchema = z
  .object({
    name: z.string().trim().min(2, "Ingresá el nombre de la obra").max(160),
    client_id: z.string(),
    address: z.string().trim().min(2, "Ingresá la dirección").max(200),
    locality: z.string().trim().min(2, "Ingresá la localidad").max(80),
    department: z.string().min(2),
    padron: optionalText(30).regex(/^[0-9/\s-]*$/, "Solo números"),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    project_type: z.enum(Object.keys(PROJECT_TYPES) as [ProjectType, ...ProjectType[]]),
    description: optionalText(4000),
    responsible_id: z.string(),
    start_date: dateString,
    due_date: dateString,
    status: z.enum(SELECTABLE_STATUS as [ProjectStatus, ...ProjectStatus[]]),
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    path: ["due_date"],
    message: "La finalización no puede ser anterior al inicio",
  });

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const stageSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre de la etapa").max(120),
    weight: z.number().int().min(1, "Mínimo 1").max(100, "Máximo 100"),
    progress: z.number().int().min(0).max(100),
    start_date: dateString,
    due_date: dateString,
  })
  .refine((v) => !v.start_date || !v.due_date || v.due_date >= v.start_date, {
    path: ["due_date"],
    message: "La fecha de fin no puede ser anterior al inicio",
  });

export type StageFormValues = z.infer<typeof stageSchema>;

export const noteSchema = z.object({
  title: z.string().trim().min(1, "Ingresá un título").max(160),
  category: z.enum(Object.keys(NOTE_CATEGORIES) as [NoteCategory, ...NoteCategory[]]),
});

/** Acepta "12.500,50", "12500.5" o "12500" */
export function parseMoney(value: string): number | null {
  const v = value.trim().replace(/\s/g, "");
  if (!v) return null;
  let normalized: string;
  if (/,\d{1,2}$/.test(v)) normalized = v.replace(/\./g, "").replace(",", "."); // 12.500,50
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) normalized = v.replace(/\./g, ""); // 12.500
  else normalized = v.replace(/,/g, ""); // 12500.5 o 12,500.5
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

const moneyText = (required: boolean) =>
  z.string().refine((v) => {
    const n = parseMoney(v);
    if (n === null) return !required;
    return !Number.isNaN(n) && n > 0 && n < 1e12;
  }, required ? "Ingresá un monto mayor a 0" : "Monto no válido");

export const paymentSchema = z
  .object({
    paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
    amount: moneyText(true),
    currency: z.enum(["UYU", "USD"]),
    exchange_rate: z.string(),
    concept: z.string().trim().min(1, "Ingresá el concepto").max(160),
    method: z.enum(["transferencia", "efectivo", "cheque", "deposito", "otro"]),
    receipt: optionalText(60),
    notes: optionalText(2000),
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;

/** "" → null para guardar en la base */
export const nullIfEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
