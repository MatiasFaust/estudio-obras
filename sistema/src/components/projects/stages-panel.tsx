"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Field } from "@/components/common/field";
import { ProgressBar } from "@/components/common/progress-bar";
import { useAction, useRepo, useSession, useStages } from "@/lib/data/hooks";
import { formatDate, isOverdue } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Project, Stage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { stageSchema, type StageFormValues } from "@/lib/validation";

const QUICK = [0, 25, 50, 75, 100];

export function StagesPanel({ project }: { project: Project }) {
  const repo = useRepo();
  const { profile } = useSession();
  const { run } = useAction();
  const stages = useStages(project.id);
  const [editing, setEditing] = useState<{ stage: Stage | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<Stage | null>(null);
  const [manual, setManual] = useState(String(project.manual_progress ?? project.progress));
  const manage = can.manageStages(profile);
  const list = stages.data ?? [];
  const totalWeight = list.reduce((a, s) => a + s.weight, 0);

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Avance general: {project.progress}%</div>
            <p className="text-xs text-muted-foreground">
              {project.progress_mode === "etapas"
                ? "Calculado automáticamente con el avance de cada etapa, según su peso."
                : "Fijado manualmente por un arquitecto o administrador."}
            </p>
          </div>
          {can.setManualProgress(profile) && (
            <div className="flex flex-wrap items-center gap-2">
              {project.progress_mode === "etapas" ? (
                <Button variant="outline" size="sm" onClick={() => run(() => repo.setProgressMode(project.id, "manual", project.progress), "Avance en modo manual")}>
                  Ajustar manualmente
                </Button>
              ) : (
                <>
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Number(manual);
                      if (!Number.isInteger(n) || n < 0 || n > 100) return;
                      run(() => repo.setProgressMode(project.id, "manual", n), "Avance actualizado");
                    }}
                  >
                    <Input type="number" min={0} max={100} value={manual} onChange={(e) => setManual(e.target.value)} className="h-7 w-20" aria-label="Avance manual (%)" />
                    <Button type="submit" size="sm">Guardar</Button>
                  </form>
                  <Button variant="outline" size="sm" onClick={() => run(() => repo.setProgressMode(project.id, "etapas", null), "Avance calculado por etapas")}>
                    Calcular por etapas
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <ProgressBar value={project.progress} className="mt-3" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Etapas y cronograma</h2>
        {manage && (
          <Button size="sm" onClick={() => setEditing({ stage: null, key: Date.now() })}><Plus /> Agregar etapa</Button>
        )}
      </div>

      {stages.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando etapas…</p>
      ) : list.length === 0 ? (
        <EmptyState icon={ListChecks} title="Sin etapas definidas" description="Agregá etapas (por ejemplo: cimentación, estructura, terminaciones) para seguir el avance y el cronograma." />
      ) : (
        <ol className="grid gap-2">
          {list.map((s, i) => {
            const late = s.progress < 100 && isOverdue(s.due_date);
            return (
              <li key={s.id} className="rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        peso {s.weight}{totalWeight ? ` (${Math.round((s.weight / totalWeight) * 100)}%)` : ""}
                      </span>
                    </div>
                    <div className={cn("text-xs text-muted-foreground", late && "font-medium text-destructive")}>
                      {s.start_date || s.due_date ? `${formatDate(s.start_date)} → ${formatDate(s.due_date)}` : "Sin fechas"}
                      {late && " · atrasada"}
                    </div>
                    <ProgressBar value={s.progress} className="mt-2 max-w-md" />
                  </div>
                  {manage && (
                    <div className="flex flex-wrap items-center gap-1">
                      <div className="mr-1 flex gap-0.5" role="group" aria-label={`Avance de ${s.name}`}>
                        {QUICK.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => run(() => repo.updateStage(s.id, { progress: q }))}
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[11px] tabular-nums transition-colors hover:bg-muted",
                              s.progress === q ? "bg-primary text-primary-foreground hover:bg-primary" : "text-muted-foreground",
                            )}
                          >
                            {q}%
                          </button>
                        ))}
                      </div>
                      <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => run(() => repo.moveStage(s.id, -1))}><ArrowUp /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === list.length - 1} onClick={() => run(() => repo.moveStage(s.id, 1))}><ArrowDown /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Editar etapa" onClick={() => setEditing({ stage: s, key: Date.now() })}><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Eliminar etapa" onClick={() => setDeleting(s)}><Trash2 /></Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <StageDialog key={editing.key} projectId={project.id} stage={editing.stage} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="¿Eliminar la etapa?"
        description={`Se eliminará "${deleting?.name}" y se recalculará el avance de la obra.`}
        onConfirm={() => run(() => repo.deleteStage(deleting!.id), "Etapa eliminada")}
      />
    </div>
  );
}

function StageDialog({ projectId, stage, onClose }: { projectId: string; stage: Stage | null; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const { register, handleSubmit, formState: { errors } } = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      name: stage?.name ?? "",
      weight: stage?.weight ?? 10,
      progress: stage?.progress ?? 0,
      start_date: stage?.start_date ?? "",
      due_date: stage?.due_date ?? "",
    },
  });

  const submit = handleSubmit(async (v) => {
    const input = { ...v, name: v.name.trim(), start_date: v.start_date || null, due_date: v.due_date || null };
    const ok = await run(
      () => (stage ? repo.updateStage(stage.id, input) : repo.createStage(projectId, input)),
      stage ? "Etapa actualizada" : "Etapa agregada",
    );
    if (ok) onClose();
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <DialogHeader><DialogTitle>{stage ? "Editar etapa" : "Nueva etapa"}</DialogTitle></DialogHeader>
          <Field label="Nombre" htmlFor="s-name" error={errors.name?.message}>
            <Input id="s-name" autoFocus placeholder="Ej.: Estructura" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (1 a 100)" htmlFor="s-weight" error={errors.weight?.message} hint="Importancia relativa en el avance.">
              <Input id="s-weight" type="number" min={1} max={100} {...register("weight", { valueAsNumber: true })} />
            </Field>
            <Field label="Avance (%)" htmlFor="s-progress" error={errors.progress?.message}>
              <Input id="s-progress" type="number" min={0} max={100} {...register("progress", { valueAsNumber: true })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inicio" htmlFor="s-start" optional><Input id="s-start" type="date" {...register("start_date")} /></Field>
            <Field label="Fin" htmlFor="s-due" optional error={errors.due_date?.message}><Input id="s-due" type="date" {...register("due_date")} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar etapa"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
