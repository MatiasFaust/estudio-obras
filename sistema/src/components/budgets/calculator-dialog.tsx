"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Calculator, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import type { BudgetSettings, Client, Project } from "@/lib/types";
import { parseMoney } from "@/lib/validation";
import { money } from "./budget-text";
import { calculate, prefillQuery } from "./calculator";

function Row({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}{hint && <span className="block text-xs">{hint}</span>}</span>
      <span className={strong ? "text-lg font-semibold tabular-nums" : "text-sm font-medium tabular-nums"}>{value}</span>
    </div>
  );
}

/** Ventanita de la calculadora de presupuestos */
export function CalculatorDialog({
  open, onOpenChange, settings, projects, clients,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: BudgetSettings | null | undefined;
  projects: Project[];
  clients: Client[];
}) {
  const router = useRouter();
  const [typeName, setTypeName] = useState("");
  const [area, setArea] = useState("");
  const [projectId, setProjectId] = useState("");

  const types = settings?.calc_types ?? [];
  const type = types.find((t) => t.name === typeName) ?? types[0];
  const m2 = parseMoney(area) ?? NaN;
  const r = settings && type ? calculate(settings, type, m2) : null;
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const openProjects = projects.filter((p) => p.status !== "archivada");
  const $ = (n: number | null) => (n === null ? "—" : money(n, "UYU"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Calculator className="size-5" /> Calculadora de presupuestos</DialogTitle>
          <DialogDescription>Elegí el tipo de trabajo y la superficie. Los valores se cambian en la plantilla.</DialogDescription>
        </DialogHeader>

        {!settings ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : types.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay valores cargados. Cargalos en{" "}
            <Link href="/pagos/plantilla#calculadora" className="text-primary hover:underline" onClick={() => onOpenChange(false)}>Plantilla → Calculadora</Link>
            {" "}(precio por m² de cada tipo de trabajo, valor del jornal y gastos).
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Field label="Tipo de trabajo">
                <SimpleSelect value={type?.name ?? ""} onChange={setTypeName} options={types.map((t) => ({ value: t.name, label: t.name }))} aria-label="Tipo de trabajo" />
              </Field>
              <Field label="Superficie (m²)" htmlFor="calc-area">
                <Input id="calc-area" inputMode="decimal" autoFocus value={area} onChange={(e) => setArea(e.target.value)} placeholder="Ej.: 86" />
              </Field>
            </div>

            {r && Number.isFinite(m2) && m2 > 0 ? (
              <div className="divide-y rounded-lg border px-3">
                <div className="py-1.5">
                  <Row label="Honorarios" value={r.fee === null ? "—" : `${$(r.fee)} + IVA`} hint={type?.fee_per_m2 ? `${$(type.fee_per_m2)} por m²` : "Sin valor por m² en la plantilla"} strong />
                  {r.feeWithIva !== null && <Row label={`Con IVA (${settings.iva_rate}%)`} value={$(r.feeWithIva)} />}
                </div>
                {r.terms.length > 0 && (
                  <div className="py-1.5">
                    <div className="pt-1 text-xs font-medium text-muted-foreground">Forma de pago</div>
                    {r.terms.map((x, i) => <Row key={i} label={`${x.percent}% ${x.label}`} value={$(x.amount)} />)}
                  </div>
                )}
                <Row
                  label="Estimado de jornales"
                  value={r.wagesDays === null ? "—" : `${r.wagesDays} J${r.wagesAmount !== null ? ` · ${$(r.wagesAmount)}` : ""}`}
                  hint={settings.wage_value ? `Jornal: ${$(settings.wage_value)}` : r.wagesDays !== null ? "Falta el valor del jornal en la plantilla" : undefined}
                />
                <Row label="Gastos estimados" value={$(r.expenses)} hint="Copias, timbres, derechos, tributos" />
                <Row label="Costo estimado de la obra" value={$(r.buildCost)} hint={type?.build_cost_per_m2 ? `${$(type.build_cost_per_m2)} por m²` : undefined} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Poné la superficie para ver el cálculo.</p>
            )}

            {r && r.fee !== null && (
              <form
                className="grid gap-2 rounded-lg bg-muted/50 p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!projectId || !type) return;
                  router.push(`/obras/${projectId}/presupuestos/nuevo?${prefillQuery(type.name, m2, r)}`);
                }}
              >
                <Field label="Armar un presupuesto con esto para la obra">
                  <SimpleSelect
                    value={projectId}
                    onChange={setProjectId}
                    placeholder="Elegí una obra"
                    aria-label="Obra del presupuesto"
                    options={openProjects.map((p) => ({ value: p.id, label: `${p.name}${p.client_id && clientName.get(p.client_id) ? ` · ${clientName.get(p.client_id)}` : ""}` }))}
                  />
                </Field>
                <Button type="submit" disabled={!projectId} className="justify-self-end"><FilePlus2 /> Armar presupuesto</Button>
              </form>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
