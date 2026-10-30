"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { PageHeader } from "@/components/common/page-header";
import { DEFAULT_LOGO } from "@/components/budgets/budget-text";
import { ImageInput, linesToText, numText, parseOptional, PaymentTermsEditor, textToLines } from "@/components/budgets/form-parts";
import { useAction, useBudgetSettings, useRepo, useSession } from "@/lib/data/hooks";
import { can } from "@/lib/permissions";
import type { BudgetPartner, BudgetSettings, BudgetSigner } from "@/lib/types";

/** Plantilla de los presupuestos: lo que se repite en todos (se carga una sola vez) */
export default function BudgetTemplatePage() {
  const { profile } = useSession();
  const allowed = can.viewFinances(profile);
  const settings = useBudgetSettings(allowed);

  if (!allowed) return <EmptyState icon={Lock} title="Sin permiso" description="La plantilla de presupuestos es solo para administradores." />;
  if (settings.isLoading || !settings.data) return <p className="py-8 text-sm text-muted-foreground">Cargando plantilla…</p>;
  // `key`: si otro administrador la cambia, se vuelve a cargar el formulario
  return <TemplateForm key={settings.data.updated_at} initial={settings.data} />;
}

function TemplateForm({ initial }: { initial: BudgetSettings }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [t, setT] = useState(initial);
  const [includes, setIncludes] = useState(linesToText(initial.includes));
  const [footerLines, setFooterLines] = useState(linesToText(initial.footer.lines));
  const [partners, setPartners] = useState(initial.footer.partners.map((p) => ({ ...p, text: linesToText(p.lines) })));
  const set = <K extends keyof BudgetSettings>(k: K, v: BudgetSettings[K]) => setT((x) => ({ ...x, [k]: v }));
  const setSigner = (i: number, patch: Partial<BudgetSigner>) => set("signers", t.signers.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setPartner = (i: number, patch: Partial<BudgetPartner & { text: string }>) => setPartners((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  // Calculadora: los números se editan como texto ("1.200", "1,5")
  const [calcTypes, setCalcTypes] = useState(initial.calc_types.map((c) => ({
    name: c.name, fee: numText(c.fee_per_m2), wages: numText(c.wages_per_m2), build: numText(c.build_cost_per_m2),
  })));
  const [calc, setCalc] = useState({
    wage: numText(initial.wage_value), fixed: numText(initial.expenses_fixed),
    perM2: numText(initial.expenses_per_m2), iva: numText(initial.iva_rate),
  });
  const [calcError, setCalcError] = useState<string | null>(null);
  const setCalcType = (i: number, patch: Partial<(typeof calcTypes)[number]>) => setCalcTypes((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { updated_at: _, ...rest } = t;
    void _;
    const types = calcTypes.filter((c) => c.name.trim()).map((c) => ({
      name: c.name.trim(), fee_per_m2: parseOptional(c.fee), wages_per_m2: parseOptional(c.wages), build_cost_per_m2: parseOptional(c.build),
    }));
    const values = { wage_value: parseOptional(calc.wage), expenses_fixed: parseOptional(calc.fixed), expenses_per_m2: parseOptional(calc.perM2) };
    const iva = parseOptional(calc.iva) ?? 22;
    const bad = [...types.flatMap((c) => [c.fee_per_m2, c.wages_per_m2, c.build_cost_per_m2]), ...Object.values(values)]
      .some((n) => n !== null && (Number.isNaN(n) || n < 0));
    if (bad || Number.isNaN(iva) || iva < 0 || iva > 100) {
      setCalcError("Hay un número mal escrito en la calculadora. Usá solo números, por ejemplo 1.200 o 1,5.");
      return;
    }
    setCalcError(null);
    await run(() => repo.saveBudgetSettings({
      ...rest,
      calc_types: types,
      ...values,
      iva_rate: iva,
      includes: textToLines(includes),
      payment_terms: t.payment_terms.filter((x) => x.label.trim() || x.percent),
      footer: {
        lines: textToLines(footerLines),
        partners: partners.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), lines: textToLines(p.text), logo: p.logo })),
      },
    }), "Plantilla guardada");
  }

  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4">
      <Link href="/pagos" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Presupuestos
      </Link>
      <PageHeader
        className="mb-0"
        title="Plantilla de presupuestos"
        description="Lo que se repite en todos los presupuestos. Cada presupuesto nuevo arranca con estos textos, y después se pueden cambiar en cada uno."
        actions={<Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar plantilla"}</Button>}
      />

      <Card size="sm">
        <CardHeader><CardTitle>Encabezado</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Nombre del estudio" htmlFor="tp-name">
            <Input id="tp-name" value={t.studio_name} onChange={(e) => set("studio_name", e.target.value)} />
          </Field>
          <Field label="Debajo del nombre" htmlFor="tp-tagline" hint="Ej.: Arquitectura | Interiorismo | Paisajismo">
            <Input id="tp-tagline" value={t.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>
          <Field label="Dirección" htmlFor="tp-address">
            <Input id="tp-address" value={t.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label="Logo principal" hint="Va arriba a la izquierda de la hoja. Si no subís ninguno, va el logo RF del estudio (el de la izquierda).">
            <div className="flex flex-wrap items-center gap-3">
              {!t.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa del logo que va por defecto
                <img src={DEFAULT_LOGO} alt="Logo RF del estudio" className="size-16 rounded-md border" />
              )}
              <ImageInput label="Logo principal" value={t.logo} onChange={(v) => set("logo", v)} />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Textos</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Saludo" htmlFor="tp-greeting">
            <Input id="tp-greeting" value={t.greeting} onChange={(e) => set("greeting", e.target.value)} />
          </Field>
          <Field
            label="Párrafo de presentación"
            htmlFor="tp-intro"
            hint={<>Se completa solo: <b>{"{trabajo}"}</b>, <b>{"{area}"}</b> y <b>{"{padron}"}</b>. Para negrita: **texto**. Para subrayado: __texto__.</>}
          >
            <Textarea id="tp-intro" rows={3} value={t.intro} onChange={(e) => set("intro", e.target.value)} />
          </Field>
          <Field label="El proyecto incluye" htmlFor="tp-includes" hint="Una cosa por línea.">
            <Textarea id="tp-includes" rows={5} value={includes} onChange={(e) => setIncludes(e.target.value)} />
          </Field>
          <Field label="No se incluye" htmlFor="tp-excludes" optional>
            <Input id="tp-excludes" value={t.excludes} onChange={(e) => set("excludes", e.target.value)} placeholder="Ej.: No se incluye Dirección de Obra." />
          </Field>
          <Field label="Gastos (texto)" htmlFor="tp-expenses" optional hint="El monto se pone en cada presupuesto.">
            <Input id="tp-expenses" value={t.expenses_text} onChange={(e) => set("expenses_text", e.target.value)} />
          </Field>
          <Field label="Nota" htmlFor="tp-note" optional>
            <Textarea id="tp-note" rows={2} value={t.note} onChange={(e) => set("note", e.target.value)} />
          </Field>
          <Field label="Despedida" htmlFor="tp-closing">
            <Input id="tp-closing" value={t.closing} onChange={(e) => set("closing", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Forma de pago</CardTitle></CardHeader>
        <CardContent>
          <PaymentTermsEditor terms={t.payment_terms} onChange={(v) => set("payment_terms", v)} />
        </CardContent>
      </Card>

      <Card size="sm" id="calculadora">
        <CardHeader><CardTitle>Calculadora</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-xs text-muted-foreground">Valores en pesos que usa la calculadora (se abre al entrar a Presupuestos). Lo que quede vacío no se calcula.</p>
          <div className="grid gap-2">
            <div className="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_110px_130px_32px]">
              <span>Tipo de trabajo</span><span>Honorarios por m²</span><span>Jornales por m²</span><span>Costo de obra por m²</span><span />
            </div>
            {calcTypes.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_120px_110px_130px_32px] sm:border-0 sm:p-0">
                <Input value={c.name} onChange={(e) => setCalcType(i, { name: e.target.value })} placeholder="Ej.: Reforma" aria-label={`Tipo de trabajo ${i + 1}`} />
                <Input inputMode="decimal" value={c.fee} onChange={(e) => setCalcType(i, { fee: e.target.value })} placeholder="$ por m²" aria-label={`Honorarios por m² de ${c.name || "este tipo"}`} />
                <Input inputMode="decimal" value={c.wages} onChange={(e) => setCalcType(i, { wages: e.target.value })} placeholder="Ej.: 1,5" aria-label={`Jornales por m² de ${c.name || "este tipo"}`} />
                <Input inputMode="decimal" value={c.build} onChange={(e) => setCalcType(i, { build: e.target.value })} placeholder="$ por m²" aria-label={`Costo de obra por m² de ${c.name || "este tipo"}`} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Quitar ${c.name || "este tipo"}`} onClick={() => setCalcTypes((cs) => cs.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => setCalcTypes((cs) => [...cs, { name: "", fee: "", wages: "", build: "" }])}>
              <Plus /> Agregar tipo de trabajo
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Valor del jornal" htmlFor="tp-wage" optional>
              <Input id="tp-wage" inputMode="decimal" value={calc.wage} onChange={(e) => setCalc((x) => ({ ...x, wage: e.target.value }))} />
            </Field>
            <Field label="Gastos fijos" htmlFor="tp-exp-fixed" optional>
              <Input id="tp-exp-fixed" inputMode="decimal" value={calc.fixed} onChange={(e) => setCalc((x) => ({ ...x, fixed: e.target.value }))} />
            </Field>
            <Field label="Gastos por m²" htmlFor="tp-exp-m2" optional>
              <Input id="tp-exp-m2" inputMode="decimal" value={calc.perM2} onChange={(e) => setCalc((x) => ({ ...x, perM2: e.target.value }))} />
            </Field>
            <Field label="IVA (%)" htmlFor="tp-iva">
              <Input id="tp-iva" inputMode="decimal" value={calc.iva} onChange={(e) => setCalc((x) => ({ ...x, iva: e.target.value }))} />
            </Field>
          </div>
          {calcError && <p className="text-sm text-destructive" role="alert">{calcError}</p>}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Firmas</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {t.signers.map((sig, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre" htmlFor={`tp-sig-${i}`}>
                  <Input id={`tp-sig-${i}`} value={sig.name} onChange={(e) => setSigner(i, { name: e.target.value })} />
                </Field>
                <Field label="Cargo" htmlFor={`tp-sigt-${i}`}>
                  <Input id={`tp-sigt-${i}`} value={sig.title} onChange={(e) => setSigner(i, { title: e.target.value })} placeholder="Ej.: Arq. y Paisajista" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ImageInput label={`Firma de ${sig.name || "esta persona"}`} value={sig.image} onChange={(v) => setSigner(i, { image: v })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => set("signers", t.signers.filter((_, j) => j !== i))}><Trash2 /> Quitar firma</Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Sacale una foto a la firma sobre una hoja blanca, recortala bien ajustada y subila. Se guarda en la base de datos privada del sistema.</p>
          <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => set("signers", [...t.signers, { name: "", title: "", image: null }])}>
            <Plus /> Agregar firma
          </Button>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader><CardTitle>Pie de página</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Contactos del estudio" htmlFor="tp-footer" hint="Uno por línea. Ej.: @usuario de Instagram, teléfonos, correo (el ícono se pone solo).">
            <Textarea id="tp-footer" rows={3} value={footerLines} onChange={(e) => setFooterLines(e.target.value)} />
          </Field>
          {partners.map((p, i) => (
            <div key={i} className="grid gap-3 rounded-lg border p-3">
              <Field label="Estudio asociado" htmlFor={`tp-par-${i}`}>
                <Input id={`tp-par-${i}`} value={p.name} onChange={(e) => setPartner(i, { name: e.target.value })} placeholder="Ej.: JF. paisajismo y jardinería" />
              </Field>
              <Field label="Sus contactos" htmlFor={`tp-parl-${i}`} hint="Uno por línea.">
                <Textarea id={`tp-parl-${i}`} rows={2} value={p.text} onChange={(e) => setPartner(i, { text: e.target.value })} />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ImageInput label={`Logo de ${p.name || "este estudio"}`} value={p.logo} onChange={(v) => setPartner(i, { logo: v })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => setPartners((ps) => ps.filter((_, j) => j !== i))}><Trash2 /> Quitar</Button>
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" className="justify-self-start" onClick={() => setPartners((ps) => [...ps, { name: "", lines: [], text: "", logo: null }])}>
            <Plus /> Agregar estudio asociado
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar plantilla"}</Button>
      </div>
    </form>
  );
}
