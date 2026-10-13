"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Crosshair, Landmark, MapPin, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ClientDialog } from "@/components/clients/client-dialog";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { LocationPicker } from "@/components/map";
import { DEPARTMENTS, PROJECT_TYPES, ROLES, SELECTABLE_STATUS, STATUS } from "@/lib/constants";
import { useAction, useClients, useMembers, useProfiles, useRepo } from "@/lib/data/hooks";
import { geocodeAddress, locatePadron, type GeoResult } from "@/lib/geo";
import type { Project, ProjectInput } from "@/lib/types";
import { nullIfEmpty, projectSchema, type ProjectFormValues } from "@/lib/validation";

const TYPE_OPTIONS = Object.entries(PROJECT_TYPES).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = SELECTABLE_STATUS.map((s) => ({ value: s, label: STATUS[s].label }));
const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: d }));

export function ProjectForm({
  project,
  initialPoint,
}: {
  project?: Project;
  initialPoint?: { lat: number; lng: number } | null;
}) {
  const router = useRouter();
  const repo = useRepo();
  const { run, pending } = useAction();
  const clients = useClients();
  const profiles = useProfiles();
  const members = useMembers(project?.id ?? null);
  const [memberIds, setMemberIds] = useState<string[] | null>(null);
  const [newClient, setNewClient] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<{ point: { lat: number; lng: number }; zoom: number; key: number } | null>(null);
  const [searching, setSearching] = useState<"address" | "padron" | null>(null);
  const [results, setResults] = useState<GeoResult[]>([]);

  const point = project?.lat != null && project.lng != null ? { lat: project.lat, lng: project.lng } : initialPoint ?? null;

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: project?.name ?? "",
      client_id: project?.client_id ?? "",
      address: project?.address ?? "",
      locality: project?.locality ?? "Paysandú",
      department: project?.department ?? "Paysandú",
      padron: project?.padron ?? "",
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      project_type: project?.project_type ?? "vivienda",
      description: project?.description ?? "",
      responsible_id: project?.responsible_id ?? "",
      start_date: project?.start_date ?? "",
      due_date: project?.due_date ?? "",
      status: project && project.status !== "archivada" ? project.status : "anteproyecto",
    },
  });
  const { register, control, handleSubmit, setValue, getValues, formState: { errors } } = form;
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });

  const staff = (profiles.data ?? []).filter((p) => p.active && p.role !== "colaborador");
  const collaborators = (profiles.data ?? []).filter((p) => p.active && p.role === "colaborador");
  const selectedMembers = memberIds ?? members.data ?? [];

  const clientOptions = [{ value: "", label: "Sin cliente asignado" }].concat(
    (clients.data ?? [])
      .filter((c) => !c.archived_at || c.id === project?.client_id)
      .map((c) => ({ value: c.id, label: c.name })),
  );
  const responsibleOptions = [{ value: "", label: "Sin asignar" }].concat(
    staff.map((p) => ({ value: p.id, label: `${p.full_name} · ${ROLES[p.role]}` })),
  );

  function setPoint(p: { lat: number; lng: number }, fly = false) {
    setValue("lat", p.lat, { shouldDirty: true });
    setValue("lng", p.lng, { shouldDirty: true });
    if (fly) setFlyTo({ point: p, zoom: 18, key: Date.now() });
  }

  async function searchAddress() {
    const { address, locality, department } = getValues();
    if (!address.trim()) return toast.error("Escribí la dirección para buscarla.");
    setSearching("address");
    setResults([]);
    try {
      const found = await geocodeAddress(address, locality, department);
      if (!found.length) toast.error("No se encontró la dirección. Marcá la ubicación en el mapa.");
      else if (found.length === 1) setPoint(found[0], true);
      else setResults(found);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo buscar la dirección.");
    } finally {
      setSearching(null);
    }
  }

  async function searchPadron() {
    const { padron, locality, department } = getValues();
    if (!padron.trim()) return toast.error("Escribí el número de padrón.");
    setSearching("padron");
    try {
      const found = await locatePadron(padron, department, locality);
      if (!found) toast.error(`No se encontró el padrón urbano ${padron} en ${department}.`);
      else {
        setPoint(found, true);
        toast.success(`Ubicado según Catastro: ${found.label}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo consultar Catastro.");
    } finally {
      setSearching(null);
    }
  }

  const submit = handleSubmit(async (v) => {
    const input: ProjectInput = {
      name: v.name.trim(),
      client_id: v.client_id || null,
      address: v.address.trim(),
      locality: v.locality.trim(),
      department: v.department,
      padron: nullIfEmpty(v.padron),
      lat: v.lat,
      lng: v.lng,
      project_type: v.project_type,
      description: nullIfEmpty(v.description),
      responsible_id: v.responsible_id || null,
      start_date: v.start_date || null,
      due_date: v.due_date || null,
      status: v.status,
    };
    const result: { id?: string } = {};
    const ok = await run(async () => {
      if (project) {
        await repo.updateProject(project.id, input);
        if (memberIds) await repo.setMembers(project.id, memberIds);
        result.id = project.id;
      } else {
        result.id = (await repo.createProject(input, selectedMembers)).id;
      }
    }, project ? "Cambios guardados" : "Obra creada");
    if (ok && result.id) router.push(`/obras/${result.id}`);
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <Card size="sm">
          <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Nombre de la obra" htmlFor="p-name" error={errors.name?.message}>
              <Input id="p-name" autoFocus aria-invalid={!!errors.name} placeholder="Ej.: Vivienda Rodríguez" {...register("name")} />
            </Field>
            <Field label="Cliente">
              <div className="flex gap-2">
                <Controller control={control} name="client_id" render={({ field }) => (
                  <SimpleSelect value={field.value} onChange={field.onChange} options={clientOptions} aria-label="Cliente" />
                )} />
                <Button type="button" variant="outline" size="icon" aria-label="Nuevo cliente" title="Nuevo cliente" onClick={() => setNewClient(Date.now())}>
                  <Plus />
                </Button>
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de proyecto">
                <Controller control={control} name="project_type" render={({ field }) => (
                  <SimpleSelect value={field.value} onChange={field.onChange} options={TYPE_OPTIONS} aria-label="Tipo de proyecto" />
                )} />
              </Field>
              <Field label="Estado">
                <Controller control={control} name="status" render={({ field }) => (
                  <SimpleSelect value={field.value} onChange={field.onChange} options={STATUS_OPTIONS} aria-label="Estado" />
                )} />
              </Field>
            </div>
            <Field label="Arquitecto responsable">
              <Controller control={control} name="responsible_id" render={({ field }) => (
                <SimpleSelect value={field.value} onChange={field.onChange} options={responsibleOptions} aria-label="Responsable" />
              )} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de inicio" htmlFor="p-start" optional error={errors.start_date?.message}>
                <Input id="p-start" type="date" {...register("start_date")} />
              </Field>
              <Field label="Finalización prevista" htmlFor="p-due" optional error={errors.due_date?.message}>
                <Input id="p-due" type="date" aria-invalid={!!errors.due_date} {...register("due_date")} />
              </Field>
            </div>
            <Field label="Descripción" htmlFor="p-desc" optional error={errors.description?.message}>
              <Textarea id="p-desc" rows={4} {...register("description")} />
            </Field>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader><CardTitle>Colaboradores con acceso</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-2 text-xs text-muted-foreground">
              Administradores y arquitectos ven todas las obras. Los colaboradores solo ven las obras en las que están asignados.
            </p>
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay colaboradores registrados.</p>
            ) : (
              <div className="grid gap-2">
                {collaborators.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedMembers.includes(p.id)}
                      onCheckedChange={(checked) =>
                        setMemberIds(checked ? [...selectedMembers, p.id] : selectedMembers.filter((x) => x !== p.id))
                      }
                    />
                    {p.full_name}
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-4">
        <Card size="sm">
          <CardHeader><CardTitle>Dirección y ubicación</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <Field label="Dirección" htmlFor="p-address" error={errors.address?.message}>
              <div className="flex gap-2">
                <Input id="p-address" aria-invalid={!!errors.address} placeholder="Ej.: 18 de Julio 1234" {...register("address")} />
                <Button type="button" variant="outline" onClick={searchAddress} disabled={searching !== null}>
                  <Search /> {searching === "address" ? "Buscando…" : "Buscar"}
                </Button>
              </div>
            </Field>
            {results.length > 1 && (
              <div className="rounded-lg border bg-muted/40 p-1.5 text-xs">
                <div className="flex items-center justify-between px-1.5 pb-1 text-muted-foreground">
                  Elegí el resultado correcto
                  <button type="button" onClick={() => setResults([])} aria-label="Cerrar resultados"><X className="size-3.5" /></button>
                </div>
                {results.map((r, i) => (
                  <button key={i} type="button" className="block w-full rounded-md px-1.5 py-1 text-left hover:bg-background"
                    onClick={() => { setPoint(r, true); setResults([]); }}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Localidad" htmlFor="p-locality" error={errors.locality?.message}>
                <Input id="p-locality" {...register("locality")} />
              </Field>
              <Field label="Departamento">
                <Controller control={control} name="department" render={({ field }) => (
                  <SimpleSelect value={field.value} onChange={field.onChange} options={DEPT_OPTIONS} aria-label="Departamento" />
                )} />
              </Field>
            </div>
            <Field label="Padrón" htmlFor="p-padron" optional error={errors.padron?.message}
              hint="Con el número de padrón urbano se puede ubicar el predio según Catastro.">
              <div className="flex gap-2">
                <Input id="p-padron" inputMode="numeric" aria-invalid={!!errors.padron} {...register("padron")} />
                <Button type="button" variant="outline" onClick={searchPadron} disabled={searching !== null}>
                  <Landmark /> {searching === "padron" ? "Consultando…" : "Ubicar por padrón"}
                </Button>
              </div>
            </Field>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Ubicación en el mapa</span>
                {lat !== null && lng !== null ? (
                  <span className="flex items-center gap-2 text-primary">
                    <MapPin className="size-3.5" /> {lat.toFixed(5)}, {lng.toFixed(5)}
                    <button type="button" className="text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => { setValue("lat", null); setValue("lng", null); }}>
                      Quitar
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><Crosshair className="size-3.5" /> Tocá el mapa para marcarla</span>
                )}
              </div>
              <div className="isolate h-80 overflow-hidden rounded-lg border">
                <LocationPicker
                  value={lat !== null && lng !== null ? { lat, lng } : null}
                  onChange={(p) => setPoint(p)}
                  flyTo={flyTo}
                  className="h-full w-full"
                />
              </div>
              <p className="text-xs text-muted-foreground">El marcador se puede arrastrar para ajustar la posición.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : project ? "Guardar cambios" : "Crear obra"}</Button>
        </div>
      </div>

      {newClient && (
        <ClientDialog
          key={newClient}
          open
          onOpenChange={(o) => !o && setNewClient(null)}
          onSaved={(c) => setValue("client_id", c.id, { shouldDirty: true })}
        />
      )}
    </form>
  );
}
