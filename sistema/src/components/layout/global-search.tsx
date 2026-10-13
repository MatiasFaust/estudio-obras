"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Lightbulb, Search, StickyNote, User } from "lucide-react";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { StatusDot } from "@/components/common/status-badge";
import { useClients, useNotes, useProjects } from "@/lib/data/hooks";
import { normalize } from "@/lib/format";

/**
 * Buscador global (Ctrl/⌘ + K). Busca en obras, clientes y notas.
 * Los resultados vienen de las mismas consultas que respetan los permisos del usuario.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const projects = useProjects();
  const clients = useClients();
  const notes = useNotes();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-md items-center gap-2 rounded-lg border bg-background px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/20"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate text-left">Buscar obras, clientes, notas…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Buscador global" description="Buscar obras, clientes y notas">
        {/* Coincidencia por palabras, sin tildes ni mayúsculas */}
        <Command filter={(value, search) => (normalize(search).split(/\s+/).every((w) => normalize(value).includes(w)) ? 1 : 0)}>
        <CommandInput placeholder="Escribí para buscar…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          {!!projects.data?.length && (
            <CommandGroup heading="Obras">
              {projects.data.map((p) => (
                <CommandItem key={p.id} value={`obra ${p.code} ${p.name} ${p.address} ${p.locality} ${p.padron ?? ""}`} onSelect={() => go(`/obras/${p.id}`)}>
                  <Building2 />
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <StatusDot status={p.status} />
                    {p.code}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!clients.data?.length && (
            <CommandGroup heading="Clientes">
              {clients.data.map((c) => (
                <CommandItem key={c.id} value={`cliente ${c.name} ${c.document ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`} onSelect={() => go(`/clientes/${c.id}`)}>
                  <User />
                  <span className="truncate">{c.name}</span>
                  {c.phone && <span className="ml-auto text-xs text-muted-foreground">{c.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {!!notes.data?.length && (
            <CommandGroup heading="Notas e ideas">
              {notes.data.map((n) => (
                <CommandItem
                  key={n.id}
                  value={`nota ${n.title} ${n.content_text.slice(0, 300)}`}
                  onSelect={() => go(n.project_id ? `/obras/${n.project_id}?tab=notas` : "/ideas")}
                >
                  {n.project_id ? <StickyNote /> : <Lightbulb />}
                  <span className="truncate">{n.title}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {n.project_id ? projectName(n.project_id) : "Ideas del estudio"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
