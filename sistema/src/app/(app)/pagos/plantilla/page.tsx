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
import { ImageInput, linesToText, PaymentTermsEditor, textToLines } from "@/components/budgets/form-parts";
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { updated_at: _, ...rest } = t;
    void _;
    await run(() => repo.saveBudgetSettings({
      ...rest,
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
