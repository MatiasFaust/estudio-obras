"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { SimpleSelect } from "@/components/common/simple-select";
import { NOTE_CATEGORIES } from "@/lib/constants";
import { useAction, useRepo } from "@/lib/data/hooks";
import type { Note, NoteCategory } from "@/lib/types";
import { noteSchema } from "@/lib/validation";
import { RichTextEditor, type RichTextValue } from "./rich-text";

const CATEGORY_OPTIONS = Object.entries(NOTE_CATEGORIES).map(([value, c]) => ({ value, label: c.label }));

/** Crear o editar una nota. Se monta con `key` para reiniciar el formulario. */
export function NoteDialog({
  open,
  onOpenChange,
  projectId,
  note,
  defaultCategory = "idea",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  note?: Note | null;
  defaultCategory?: NoteCategory;
}) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [title, setTitle] = useState(note?.title ?? "");
  const [category, setCategory] = useState<NoteCategory>(note?.category ?? defaultCategory);
  const [body, setBody] = useState<RichTextValue>({ json: note?.content ?? {}, text: note?.content_text ?? "" });
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = noteSchema.safeParse({ title, category });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (body.text.length > 20000) return setError("La nota es demasiado larga (máximo 20.000 caracteres).");
    setError(null);
    const input = { project_id: projectId, title: parsed.data.title, category, content: body.json, content_text: body.text.trim() };
    const ok = await run(
      () => (note ? repo.updateNote(note.id, input) : repo.createNote(input)),
      note ? "Nota actualizada" : "Nota guardada",
    );
    if (ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{note ? "Editar nota" : projectId ? "Nueva nota" : "Nueva idea del estudio"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <Field label="Título" htmlFor="note-title">
              <Input id="note-title" value={title} maxLength={160} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="Ej.: Revisar medidas del garaje" />
            </Field>
            <Field label="Categoría">
              <SimpleSelect value={category} onChange={(v) => setCategory(v as NoteCategory)} options={CATEGORY_OPTIONS} aria-label="Categoría" />
            </Field>
          </div>
          <RichTextEditor initial={note?.content} onChange={setBody} />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar nota"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
