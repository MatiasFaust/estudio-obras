"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { LocationPicker } from "@/components/map";
import { CURRENCIES, DEPARTMENTS, PAYMENT_METHODS, PROPERTY_KINDS, PROPERTY_STATUS, PROPERTY_STATUS_ORDER } from "@/lib/constants";
import { useAction, useRepo } from "@/lib/data/hooks";
import { leaseMonths, periodLabel, today } from "@/lib/dev";
import { formatMoney } from "@/lib/format";
import type { Currency, DevLease, DevProperty, DevRentPayment, DevTenant, PaymentMethod, PropertyKind, PropertyStatus } from "@/lib/types";
import { nullIfEmpty, parseMoney } from "@/lib/validation";

const KIND_OPTIONS = Object.entries(PROPERTY_KINDS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = PROPERTY_STATUS_ORDER.map((s) => ({ value: s, label: PROPERTY_STATUS[s].label }));
const DEPARTMENT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));
const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, label]) => ({ value, label }));
const METHOD_OPTIONS = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));
const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Día ${i + 1}` }));

const asText = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : new Intl.NumberFormat("es-UY", { maximumFractionDigits: 2 }).format(n);

/** Número opcional: "" → null; texto inválido → NaN */
const optionalNumber = (v: string) => (v.trim() ? parseMoney(v) : null);

// ---------------------------------------------------------------------------
// Propiedad
// ---------------------------------------------------------------------------
export function PropertyDialog({ property, onClose, onSaved }: { property?: DevProperty | null; onClose: () => void; onSaved?: (p: DevProperty) => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [f, setF] = useState({
    name: property?.name ?? "",
    kind: property?.kind ?? ("casa" as PropertyKind),
    status: property?.status ?? ("desocupada" as PropertyStatus),
    address: property?.address ?? "",
    locality: property?.locality ?? "Paysandú",
    department: property?.department ?? "Paysandú",
    padron: property?.padron ?? "",
    bedrooms: property?.bedrooms?.toString() ?? "",
    area_m2: asText(property?.area_m2),
    notes: property?.notes ?? "",
  });
  const [point, setPoint] = useState(property?.lat != null && property?.lng != null ? { lat: property.lat, lng: property.lng } : null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (f.name.trim().length < 2) err.name = "Ingresá un nombre (mínimo 2 caracteres)";
    const bedrooms = f.bedrooms.trim() ? Number(f.bedrooms) : null;
    if (bedrooms !== null && (!Number.isInteger(bedrooms) || bedrooms < 0 || bedrooms > 50)) err.bedrooms = "Número no válido";
    const area = optionalNumber(f.area_m2);
    if (area !== null && (Number.isNaN(area) || area <= 0)) err.area_m2 = "Superficie no válida";
    setErrors(err);
    if (Object.keys(err).length) return;
    const input = {
      name: f.name.trim(), kind: f.kind, status: f.status, address: f.address.trim(), locality: f.locality.trim(),
      department: f.department, padron: nullIfEmpty(f.padron), lat: point?.lat ?? null, lng: point?.lng ?? null,
      bedrooms, area_m2: area, notes: nullIfEmpty(f.notes),
    };
    const result: { saved?: DevProperty } = {};
    const ok = await run(async () => {
      result.saved = property ? await repo.updateDevProperty(property.id, input) : await repo.createDevProperty(input);
    }, property ? "Propiedad actualizada" : "Propiedad registrada");
    if (ok && result.saved) {
      onSaved?.(result.saved);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={save} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{property ? "Editar propiedad" : "Nueva propiedad"}</DialogTitle>
          </DialogHeader>
          <Field label="Nombre" htmlFor="pr-name" error={errors.name} hint="Ej.: Casa 1 — El Pinar">
            <Input id="pr-name" autoFocus value={f.name} onChange={(e) => set("name")(e.target.value)} aria-invalid={!!errors.name} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <SimpleSelect value={f.kind} onChange={set("kind")} options={KIND_OPTIONS} aria-label="Tipo de propiedad" />
            </Field>
            <Field label="Estado" hint="Con un contrato vigente pasa sola a 'Alquilada'">
              <SimpleSelect value={f.status} onChange={set("status")} options={STATUS_OPTIONS} aria-label="Estado" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px]">
            <Field label="Dirección" htmlFor="pr-address" optional>
              <Input id="pr-address" value={f.address} onChange={(e) => set("address")(e.target.value)} />
            </Field>
            <Field label="Localidad" htmlFor="pr-locality">
              <Input id="pr-locality" value={f.locality} onChange={(e) => set("locality")(e.target.value)} />
            </Field>
            <Field label="Departamento">
              <SimpleSelect value={f.department} onChange={set("department")} options={DEPARTMENT_OPTIONS} aria-label="Departamento" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Padrón" htmlFor="pr-padron" optional>
              <Input id="pr-padron" value={f.padron} onChange={(e) => set("padron")(e.target.value)} />
            </Field>
            <Field label="Dormitorios" htmlFor="pr-bed" optional error={errors.bedrooms}>
              <Input id="pr-bed" inputMode="numeric" value={f.bedrooms} onChange={(e) => set("bedrooms")(e.target.value)} />
            </Field>
            <Field label="Superficie (m²)" htmlFor="pr-area" optional error={errors.area_m2}>
              <Input id="pr-area" inputMode="decimal" value={f.area_m2} onChange={(e) => set("area_m2")(e.target.value)} />
            </Field>
          </div>
          <Field label="Ubicación en el mapa" hint={point ? "Podés arrastrar el marcador para corregirla." : "Hacé clic en el mapa para marcarla."}>
            <div className="isolate h-64 overflow-hidden rounded-lg border">
              <LocationPicker value={point} onChange={setPoint} className="h-full w-full" />
            </div>
          </Field>
          <Field label="Observaciones" htmlFor="pr-notes" optional>
            <Textarea id="pr-notes" rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar propiedad"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Inquilino
// ---------------------------------------------------------------------------
export function TenantDialog({ tenant, onClose, onSaved }: { tenant?: DevTenant | null; onClose: () => void; onSaved?: (t: DevTenant) => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [f, setF] = useState({
    name: tenant?.name ?? "", document: tenant?.document ?? "", phone: tenant?.phone ?? "",
    email: tenant?.email ?? "", notes: tenant?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const err: Record<string, string> = {};
    if (f.name.trim().length < 2) err.name = "Ingresá el nombre (mínimo 2 caracteres)";
    if (f.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) err.email = "Correo no válido";
    if (f.phone.trim() && !/^[0-9+()\s-]*$/.test(f.phone)) err.phone = "Solo números, espacios y + ( ) -";
    setErrors(err);
    if (Object.keys(err).length) return;
    const input = {
      name: f.name.trim(), document: nullIfEmpty(f.document), phone: nullIfEmpty(f.phone),
      email: nullIfEmpty(f.email), notes: nullIfEmpty(f.notes),
    };
    const result: { saved?: DevTenant } = {};
    const ok = await run(async () => {
      result.saved = tenant ? await repo.updateDevTenant(tenant.id, input) : await repo.createDevTenant(input);
    }, tenant ? "Inquilino actualizado" : "Inquilino registrado");
    if (ok && result.saved) {
      onSaved?.(result.saved);
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{tenant ? "Editar inquilino" : "Nuevo inquilino"}</DialogTitle>
          </DialogHeader>
          <Field label="Nombre completo" htmlFor="tn-name" error={errors.name}>
            <Input id="tn-name" autoFocus value={f.name} onChange={set("name")} aria-invalid={!!errors.name} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cédula" htmlFor="tn-doc" optional>
              <Input id="tn-doc" value={f.document} onChange={set("document")} />
            </Field>
            <Field label="Teléfono" htmlFor="tn-phone" optional error={errors.phone}>
              <Input id="tn-phone" type="tel" value={f.phone} onChange={set("phone")} aria-invalid={!!errors.phone} />
            </Field>
          </div>
          <Field label="Correo electrónico" htmlFor="tn-email" optional error={errors.email}>
            <Input id="tn-email" type="email" value={f.email} onChange={set("email")} aria-invalid={!!errors.email} />
          </Field>
          <Field label="Observaciones" htmlFor="tn-notes" optional>
            <Textarea id="tn-notes" rows={2} value={f.notes} onChange={set("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar inquilino"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Contrato
// ---------------------------------------------------------------------------
export function LeaseDialog({
  lease, propertyId, properties, tenants, onClose,
}: {
  lease?: DevLease | null;
  /** Propiedad fija (desde su ficha) */
  propertyId?: string;
  properties: DevProperty[];
  tenants: DevTenant[];
  onClose: () => void;
}) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [f, setF] = useState({
    property_id: lease?.property_id ?? propertyId ?? "",
    tenant_id: lease?.tenant_id ?? "",
    start_date: lease?.start_date ?? today(),
    end_date: lease?.end_date ?? "",
    rent_amount: asText(lease?.rent_amount),
    currency: lease?.currency ?? ("UYU" as Currency),
    due_day: String(lease?.due_day ?? 10),
    deposit: asText(lease?.deposit),
    notes: lease?.notes ?? "",
  });
  const [extraTenants, setExtraTenants] = useState<DevTenant[]>([]);
  const [newTenant, setNewTenant] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const allTenants = [...tenants, ...extraTenants.filter((t) => !tenants.some((x) => x.id === t.id))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!f.property_id) err.property_id = "Elegí la propiedad";
    if (!f.tenant_id) err.tenant_id = "Elegí el inquilino (o creá uno nuevo)";
    if (!f.start_date) err.start_date = "Ingresá la fecha de inicio";
    if (f.end_date && f.end_date < f.start_date) err.end_date = "El fin no puede ser anterior al inicio";
    const rent = parseMoney(f.rent_amount);
    if (rent === null || Number.isNaN(rent) || rent <= 0) err.rent_amount = "Ingresá el monto mensual";
    const deposit = optionalNumber(f.deposit);
    if (deposit !== null && (Number.isNaN(deposit) || deposit < 0)) err.deposit = "Monto no válido";
    setErrors(err);
    if (Object.keys(err).length) return;
    const input = {
      property_id: f.property_id, tenant_id: f.tenant_id, start_date: f.start_date, end_date: f.end_date || null,
      terminated_on: lease?.terminated_on ?? null, rent_amount: rent!, currency: f.currency, due_day: Number(f.due_day),
      deposit, notes: nullIfEmpty(f.notes),
    };
    const ok = await run(
      () => (lease ? repo.updateDevLease(lease.id, input) : repo.createDevLease(input)),
      lease ? "Contrato actualizado" : "Contrato registrado",
    );
    if (ok) onClose();
  }

  return (
    <>
      <Dialog open={!newTenant} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={save} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{lease ? "Editar contrato" : "Nuevo contrato de alquiler"}</DialogTitle>
              <DialogDescription>Con un contrato vigente la propiedad pasa a figurar como alquilada.</DialogDescription>
            </DialogHeader>
            {!propertyId && (
              <Field label="Propiedad" error={errors.property_id}>
                <SimpleSelect value={f.property_id} onChange={set("property_id")} aria-label="Propiedad"
                  options={properties.filter((p) => p.kind !== "terreno").map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
            )}
            <Field label="Inquilino" error={errors.tenant_id}
              hint={<button type="button" className="text-primary hover:underline" onClick={() => setNewTenant(true)}>+ Nuevo inquilino</button>}>
              <SimpleSelect value={f.tenant_id} onChange={set("tenant_id")} aria-label="Inquilino"
                options={allTenants.map((t) => ({ value: t.id, label: t.name }))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Inicio" htmlFor="ls-start" error={errors.start_date}>
                <Input id="ls-start" type="date" value={f.start_date} onChange={(e) => set("start_date")(e.target.value)} />
              </Field>
              <Field label="Vence" htmlFor="ls-end" optional error={errors.end_date}>
                <Input id="ls-end" type="date" value={f.end_date} onChange={(e) => set("end_date")(e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
              <Field label="Alquiler mensual" htmlFor="ls-rent" error={errors.rent_amount} hint="Ej.: 22.000">
                <Input id="ls-rent" inputMode="decimal" value={f.rent_amount} onChange={(e) => set("rent_amount")(e.target.value)} />
              </Field>
              <Field label="Moneda">
                <SimpleSelect value={f.currency} onChange={set("currency")} options={CURRENCY_OPTIONS} aria-label="Moneda" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Se paga hasta el" hint="Día del mes en que vence el alquiler">
                <SimpleSelect value={f.due_day} onChange={set("due_day")} options={DAY_OPTIONS} aria-label="Día de vencimiento" />
              </Field>
              <Field label="Depósito de garantía" htmlFor="ls-deposit" optional error={errors.deposit}>
                <Input id="ls-deposit" inputMode="decimal" value={f.deposit} onChange={(e) => set("deposit")(e.target.value)} />
              </Field>
            </div>
            <Field label="Observaciones" htmlFor="ls-notes" optional>
              <Textarea id="ls-notes" rows={2} value={f.notes} onChange={(e) => set("notes")(e.target.value)} placeholder="Ej.: garantía ANDA, ajuste anual por IPC" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contrato"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {newTenant && (
        <TenantDialog
          onClose={() => setNewTenant(false)}
          onSaved={(t) => {
            setExtraTenants((x) => [...x, t]);
            set("tenant_id")(t.id);
          }}
        />
      )}
    </>
  );
}

/** Terminar un contrato (el inquilino entrega la casa) */
export function EndLeaseDialog({ lease, onClose }: { lease: DevLease; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!date || date < lease.start_date) return setError("La fecha no puede ser anterior al inicio del contrato");
    const ok = await run(() => repo.updateDevLease(lease.id, { terminated_on: date }), "Contrato terminado");
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Terminar contrato</DialogTitle>
            <DialogDescription>Último día del alquiler. Después de esa fecha la casa pasa a figurar como desocupada.</DialogDescription>
          </DialogHeader>
          <Field label="Fecha de entrega" htmlFor="ls-term" error={error ?? undefined}>
            <Input id="ls-term" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Terminar contrato"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Cobro de alquiler
// ---------------------------------------------------------------------------
export function RentPaymentDialog({ lease, payments, onClose }: { lease: DevLease; payments: DevRentPayment[]; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  // Meses ya vencidos + el próximo, para poder cobrar por adelantado
  const months = leaseMonths(lease, payments);
  const nextDue = (() => {
    const last = months.at(-1)?.period ?? lease.start_date.slice(0, 7) + "-01";
    const [y, m] = last.split("-").map(Number);
    const d = months.length ? new Date(y, m, 1) : new Date(y, m - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();
  const options = [...months.map((x) => x.period), ...(months.some((x) => x.period === nextDue) ? [] : [nextDue])].reverse();
  const owedOf = (period: string) => months.find((x) => x.period === period)?.owed ?? lease.rent_amount;
  const firstOwed = months.find((x) => x.owed > 0)?.period ?? nextDue;

  const [period, setPeriod] = useState(firstOwed);
  const [amount, setAmount] = useState(asText(owedOf(firstOwed)));
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [receipt, setReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseMoney(amount);
    if (n === null || Number.isNaN(n) || n <= 0) return setError("Ingresá el monto cobrado");
    const ok = await run(
      () => repo.createDevPayment({ lease_id: lease.id, period, paid_on: paidOn, amount: n, method, receipt: nullIfEmpty(receipt), notes: nullIfEmpty(notes) }),
      "Cobro registrado",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={save} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>Alquiler mensual: {formatMoney(lease.rent_amount, lease.currency)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mes que paga">
              <SimpleSelect
                value={period}
                onChange={(v) => {
                  setPeriod(v);
                  setAmount(asText(owedOf(v)));
                }}
                aria-label="Mes que paga"
                options={options.map((p) => {
                  const owed = months.find((x) => x.period === p)?.owed;
                  return { value: p, label: `${periodLabel(p)}${owed ? " · debe" : owed === 0 ? " · pagado" : ""}` };
                })}
              />
            </Field>
            <Field label="Fecha de cobro" htmlFor="rp-date">
              <Input id="rp-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Monto (${lease.currency === "USD" ? "US$" : "$"})`} htmlFor="rp-amount" error={error ?? undefined}>
              <Input id="rp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Forma de pago">
              <SimpleSelect value={method} onChange={(v) => setMethod(v as PaymentMethod)} options={METHOD_OPTIONS} aria-label="Forma de pago" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="N.º de recibo" htmlFor="rp-receipt" optional>
              <Input id="rp-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} />
            </Field>
            <Field label="Observaciones" htmlFor="rp-notes" optional>
              <Input id="rp-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Registrar cobro"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
