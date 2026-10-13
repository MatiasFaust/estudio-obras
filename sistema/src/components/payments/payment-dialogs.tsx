"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { CURRENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { useAction, useRepo } from "@/lib/data/hooks";
import { convertAmount, formatMoney } from "@/lib/format";
import type { Currency, Finance, Payment } from "@/lib/types";
import { nullIfEmpty, parseMoney, paymentSchema, type PaymentFormValues } from "@/lib/validation";

const CURRENCY_OPTIONS = Object.entries(CURRENCIES).map(([value, label]) => ({ value, label }));
const METHOD_OPTIONS = Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }));
/** Fecha de hoy en hora local (no UTC: en Uruguay después de las 21 h sería "mañana") */
const today = () => format(new Date(), "yyyy-MM-dd");
const asText = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : new Intl.NumberFormat("es-UY", { maximumFractionDigits: 4 }).format(n);

/** Monto acordado de la obra */
export function FinanceDialog({ projectId, finance, onClose }: { projectId: string; finance?: Finance; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [amount, setAmount] = useState(asText(finance?.agreed_amount));
  const [currency, setCurrency] = useState<Currency>(finance?.currency ?? "USD");
  const [notes, setNotes] = useState(finance?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = parseMoney(amount);
    if (n !== null && (Number.isNaN(n) || n < 0)) return setError("Monto no válido.");
    const ok = await run(
      () => repo.setFinance(projectId, { agreed_amount: n, currency, notes: nullIfEmpty(notes) }),
      "Monto acordado guardado",
    );
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Monto acordado</DialogTitle>
            <DialogDescription>Lo que el cliente se comprometió a pagar. Los pagos en otra moneda se convierten a esta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
            <Field label="Monto" htmlFor="f-amount" error={error ?? undefined} hint="Ej.: 48.000 o 48.000,50">
              <Input id="f-amount" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Moneda">
              <SimpleSelect value={currency} onChange={(v) => setCurrency(v as Currency)} options={CURRENCY_OPTIONS} aria-label="Moneda" />
            </Field>
          </div>
          <Field label="Detalle" htmlFor="f-notes" optional>
            <Textarea id="f-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: honorarios de proyecto y dirección de obra" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Registrar o editar un pago del cliente */
export function PaymentDialog({
  projectId,
  contractCurrency,
  payment,
  onClose,
}: {
  projectId: string;
  contractCurrency: Currency;
  payment?: Payment | null;
  onClose: () => void;
}) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paid_on: payment?.paid_on ?? today(),
      amount: asText(payment?.amount),
      currency: payment?.currency ?? contractCurrency,
      exchange_rate: asText(payment?.exchange_rate),
      concept: payment?.concept ?? "",
      method: payment?.method ?? "transferencia",
      receipt: payment?.receipt ?? "",
      notes: payment?.notes ?? "",
    },
  });
  const currency = useWatch({ control, name: "currency" });
  const amountText = useWatch({ control, name: "amount" });
  const rateText = useWatch({ control, name: "exchange_rate" });
  const needsRate = currency !== contractCurrency;
  const preview = needsRate
    ? convertAmount(parseMoney(amountText) || 0, currency, contractCurrency, parseMoney(rateText) || null)
    : null;

  const submit = handleSubmit(async (v) => {
    const rate = parseMoney(v.exchange_rate);
    if (needsRate && (!rate || Number.isNaN(rate) || rate <= 0)) {
      setError("exchange_rate", { message: "Ingresá la cotización (pesos por dólar)" });
      return;
    }
    const input = {
      project_id: projectId,
      paid_on: v.paid_on,
      amount: parseMoney(v.amount)!,
      currency: v.currency,
      exchange_rate: needsRate ? rate : null,
      concept: v.concept.trim(),
      method: v.method,
      receipt: nullIfEmpty(v.receipt),
      notes: nullIfEmpty(v.notes),
    };
    const ok = await run(
      () => (payment ? repo.updatePayment(payment.id, input) : repo.createPayment(input)),
      payment ? "Pago actualizado" : "Pago registrado",
    );
    if (ok) onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{payment ? "Editar pago" : "Registrar pago"}</DialogTitle>
          </DialogHeader>
          <Field label="Concepto" htmlFor="pay-concept" error={errors.concept?.message}>
            <Input id="pay-concept" autoFocus placeholder="Ej.: Adelanto, Certificado de avance 2" aria-invalid={!!errors.concept} {...register("concept")} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
            <Field label="Fecha" htmlFor="pay-date" error={errors.paid_on?.message}>
              <Input id="pay-date" type="date" {...register("paid_on")} />
            </Field>
            <Field label="Monto" htmlFor="pay-amount" error={errors.amount?.message}>
              <Input id="pay-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
            </Field>
            <Field label="Moneda">
              <Controller control={control} name="currency" render={({ field }) => (
                <SimpleSelect value={field.value} onChange={field.onChange} options={[{ value: "UYU", label: "$ UYU" }, { value: "USD", label: "US$ USD" }]} aria-label="Moneda del pago" />
              )} />
            </Field>
          </div>
          {needsRate && (
            <Field
              label="Cotización (pesos por dólar)"
              htmlFor="pay-rate"
              error={errors.exchange_rate?.message}
              hint={preview !== null ? `Equivale a ${formatMoney(preview, contractCurrency)} del monto acordado` : `El monto acordado está en ${contractCurrency}.`}
            >
              <Input id="pay-rate" inputMode="decimal" placeholder="Ej.: 40,25" aria-invalid={!!errors.exchange_rate} {...register("exchange_rate")} />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Medio de pago">
              <Controller control={control} name="method" render={({ field }) => (
                <SimpleSelect value={field.value} onChange={field.onChange} options={METHOD_OPTIONS} aria-label="Medio de pago" />
              )} />
            </Field>
            <Field label="N.º de comprobante" htmlFor="pay-receipt" optional error={errors.receipt?.message}>
              <Input id="pay-receipt" {...register("receipt")} />
            </Field>
          </div>
          <Field label="Observaciones" htmlFor="pay-notes" optional>
            <Textarea id="pay-notes" rows={2} {...register("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar pago"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
