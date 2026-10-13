"use client";

import { useMemo, useState } from "react";
import { Check, Lightbulb, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { SimpleSelect } from "@/components/common/simple-select";
import { NOTE_CATEGORIES } from "@/lib/constants";
import { useAction, useNotes, useProfiles, useRepo, useSession } from "@/lib/data/hooks";
import { formatDateTime, matches, timeAgo } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { Note, NoteCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NoteDialog } from "./note-dialog";
import { RichTextView } from "./rich-text";

const STATUS_OPTIONS = [
  { value: "abiertas", label: "Sin resolver" },
  { value: "resueltas", label: "Resueltas" },
  { value: "todas", label: "Todas" },
];
const CATEGORY_FILTER = [{ value: "", label: "Todas las categorías" }].concat(
  Object.entries(NOTE_CATEGORIES).map(([value, c]) => ({ value, label: c.label })),
);

export function CategoryBadge({ category }: { category: NoteCategory }) {
  const c = NOTE_CATEGORIES[category];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", c.className)}>{c.label}</span>;
}

/** Notas de una obra (projectId) o "Ideas del estudio" (projectId = null) */
export function NotesPanel({ projectId }: { projectId: string | null }) {
  const notes = useNotes();
  const profiles = useProfiles();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("abiertas");
  const [editing, setEditing] = useState<{ note: Note | null; key: number } | null>(null);

  const authorName = (id: string | null) => profiles.data?.find((p) => p.id === id)?.full_name ?? "—";

  const own = useMemo(() => (notes.data ?? []).filter((n) => n.project_id === projectId), [notes.data, projectId]);
  const list = own.filter(
    (n) =>
      (!category || n.category === category) &&
      (status === "todas" || (status === "resueltas" ? !!n.resolved_at : !n.resolved_at)) &&
      matches(query, n.title, n.content_text),
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en notas…" className="pl-8" aria-label="Buscar en notas" />
        </div>
        <SimpleSelect value={category} onChange={setCategory} options={CATEGORY_FILTER} className="w-44" aria-label="Filtrar por categoría" />
        <SimpleSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} className="w-36" aria-label="Filtrar por estado" />
        <Button onClick={() => setEditing({ note: null, key: Date.now() })}>
          <Plus /> {projectId ? "Nueva nota" : "Nueva idea"}
        </Button>
      </div>

      {notes.isLoading ? (
        <p className="py-6 text-sm text-muted-foreground">Cargando notas…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={own.length ? "Ninguna nota coincide con los filtros" : projectId ? "Todavía no hay notas en esta obra" : "Todavía no hay ideas del estudio"}
          description={own.length ? undefined : "Anotá ideas, pendientes u observaciones para no perderlas."}
        />
      ) : (
        <ul className="grid gap-2">
          {list.map((n) => (
            <NoteCard key={n.id} note={n} authorName={authorName(n.author_id)} onEdit={() => setEditing({ note: n, key: Date.now() })} />
          ))}
        </ul>
      )}

      {editing && (
        <NoteDialog
          key={editing.key}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          projectId={projectId}
          note={editing.note}
          defaultCategory={projectId ? "observacion" : "idea"}
        />
      )}
    </div>
  );
}

function NoteCard({ note, authorName, onEdit }: { note: Note; authorName: string; onEdit: () => void }) {
  const repo = useRepo();
  const { profile } = useSession();
  const { run } = useAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editable = can.editNote(profile, note);
  const resolved = !!note.resolved_at;

  return (
    <li className={cn("rounded-xl border bg-card p-3.5 transition-opacity", resolved && "opacity-65")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("text-sm font-medium", resolved && "line-through")}>{note.title}</h3>
            <CategoryBadge category={note.category} />
            {resolved && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <Check className="size-3" /> Resuelta
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground" title={formatDateTime(note.created_at)}>
            {authorName} · {timeAgo(note.created_at)}
            {note.updated_at !== note.created_at && " · editada"}
          </p>
        </div>
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Acciones de la nota"><MoreHorizontal /></Button>} />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => run(() => repo.setNoteResolved(note.id, !resolved), resolved ? "Nota reabierta" : "Nota resuelta")}>
                {resolved ? <RotateCcw /> : <Check />} {resolved ? "Reabrir" : "Marcar resuelta"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}><Pencil /> Editar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}><Trash2 /> Eliminar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {note.content_text && <RichTextView value={note.content} fallback={note.content_text} className="mt-2 text-sm" />}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar la nota?"
        description={`"${note.title}" se borrará definitivamente.`}
        onConfirm={() => run(() => repo.deleteNote(note.id), "Nota eliminada")}
      />
    </li>
  );
}
