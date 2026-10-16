"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentTerm } from "@/lib/types";
import { parseMoney } from "@/lib/validation";
import { money, termAmount } from "./budget-text";
import type { Currency } from "@/lib/types";

/** Lista de textos editada como "uno por línea" */
export const linesToText = (lines: string[]) => lines.join("\n");
export const textToLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Número opcional escrito con formato uruguayo ("12.500,50"); "" → null */
export const parseOptional = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = parseMoney(v);
  return n === null || Number.isNaN(n) ? NaN : n;
};
export const numText = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 }).format(n);

/** Cuotas de la forma de pago: porcentaje + texto, con el monto calculado */
export function PaymentTermsEditor({
  terms, onChange, price, currency,
}: {
  terms: PaymentTerm[];
  onChange: (t: PaymentTerm[]) => void;
  price?: number | null;
  currency?: Currency;
}) {
  const total = terms.reduce((a, t) => a + (Number(t.percent) || 0), 0);
  const set = (i: number, patch: Partial<PaymentTerm>) => onChange(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="grid gap-2">
      {terms.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="relative w-20 shrink-0">
            <Input
              inputMode="numeric"
              value={t.percent ? String(t.percent) : ""}
              onChange={(e) => set(i, { percent: Number(e.target.value.replace(/[^\d.,]/g, "").replace(",", ".")) || 0 })}
              aria-label={`Porcentaje de la cuota ${i + 1}`}
              className="pr-6"
            />
            <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
          <Input value={t.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Ej.: al comenzar los trabajos" aria-label={`Cuándo se paga la cuota ${i + 1}`} />
          {price !== undefined && (
            <span className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {price !== null && currency ? money(termAmount(price, t.percent), currency) : "—"}
            </span>
          )}
          <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar la cuota ${i + 1}`} onClick={() => onChange(terms.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...terms, { label: "", percent: 0 }])}>
          <Plus /> Agregar cuota
        </Button>
        {terms.length > 0 && (
          <span className={total === 100 ? "text-xs text-muted-foreground" : "text-xs font-medium text-amber-700 dark:text-amber-400"}>
            Suma: {total}%{total !== 100 && " (debería dar 100%)"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Achica la imagen (máx. 600 px de ancho) y la devuelve como data URL PNG */
async function imageToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen."));
      i.src = url;
    });
    const scale = Math.min(1, 600 / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Botón para subir una imagen (firma o logo), con vista previa */
export function ImageInput({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-16 w-32 shrink-0 place-items-center overflow-hidden rounded-md border bg-white">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- vista previa de un data URL
          <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-[11px] text-muted-foreground">Sin imagen</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
          <ImagePlus /> {value ? "Cambiar" : "Subir imagen"}
        </Button>
        {value && <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>Quitar</Button>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label={label}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 8_000_000) return toast.error("La imagen es muy grande (máximo 8 MB).");
          try {
            onChange(await imageToDataUrl(file));
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "No se pudo leer la imagen.");
          }
        }}
      />
    </div>
  );
}
