"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { useAction, useRepo } from "@/lib/data/hooks";
import type { Client } from "@/lib/types";
import { clientSchema, nullIfEmpty, type ClientFormValues } from "@/lib/validation";

const KIND_OPTIONS = [
  { value: "persona", label: "Persona" },
  { value: "empresa", label: "Empresa" },
];

/** Alta o edición de cliente. Montar con `key` para reiniciar. */
export function ClientDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSaved?: (client: Client) => void;
}) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      kind: client?.kind ?? "persona",
      name: client?.name ?? "",
      document: client?.document ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      address: client?.address ?? "",
      notes: client?.notes ?? "",
    },
  });
  const { register, handleSubmit, control, formState: { errors } } = form;
  const kind = useWatch({ control, name: "kind" });

  const submit = handleSubmit(async (v) => {
    const input = {
      kind: v.kind,
      name: v.name.trim(),
      document: nullIfEmpty(v.document),
      phone: nullIfEmpty(v.phone),
      email: nullIfEmpty(v.email),
      address: nullIfEmpty(v.address),
      notes: nullIfEmpty(v.notes),
    };
    const result: { saved?: Client } = {};
    const ok = await run(async () => {
      result.saved = client ? await repo.updateClient(client.id, input) : await repo.createClient(input);
    }, client ? "Cliente actualizado" : "Cliente registrado");
    if (ok && result.saved) {
      onSaved?.(result.saved);
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form
          // Evita que el envío se propague a un formulario contenedor (alta rápida desde una obra)
          onSubmit={(e) => {
            e.stopPropagation();
            submit(e);
          }}
          className="grid gap-4"
          noValidate
        >
          <DialogHeader>
            <DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Tipo">
              <Controller control={control} name="kind" render={({ field }) => (
                <SimpleSelect value={field.value} onChange={field.onChange} options={KIND_OPTIONS} aria-label="Tipo de cliente" />
              )} />
            </Field>
            <Field label={kind === "empresa" ? "Razón social" : "Nombre completo"} htmlFor="c-name" error={errors.name?.message}>
              <Input id="c-name" autoFocus aria-invalid={!!errors.name} {...register("name")} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={kind === "empresa" ? "RUT" : "Cédula"} htmlFor="c-doc" optional error={errors.document?.message}
              hint={kind === "empresa" ? "12 dígitos" : "Ej.: 1.234.567-2"}>
              <Input id="c-doc" inputMode="numeric" aria-invalid={!!errors.document} {...register("document")} />
            </Field>
            <Field label="Teléfono" htmlFor="c-phone" optional error={errors.phone?.message}>
              <Input id="c-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            </Field>
          </div>
          <Field label="Correo electrónico" htmlFor="c-email" optional error={errors.email?.message}>
            <Input id="c-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Dirección" htmlFor="c-address" optional error={errors.address?.message}>
            <Input id="c-address" aria-invalid={!!errors.address} {...register("address")} />
          </Field>
          <Field label="Observaciones internas" htmlFor="c-notes" optional error={errors.notes?.message}>
            <Textarea id="c-notes" rows={3} {...register("notes")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar cliente"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
