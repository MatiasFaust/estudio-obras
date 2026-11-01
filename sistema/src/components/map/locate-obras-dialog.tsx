"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAction, useRepo } from "@/lib/data/hooks";
import type { Project } from "@/lib/types";
import { locateProject, type Located } from "./locate";

/** Resultado de buscar una obra: lo encontrado, null si no aparece, "error" si no se pudo consultar */
type Result = Located | null | "error";

/**
 * Ubica las obras que no tienen ubicación: busca cada una, muestra lo encontrado y guarda las
 * tildadas. Solo completa las que no tienen: no cambia ninguna ubicación ya puesta.
 */
export function LocateObrasDialog({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  const [results, setResults] = useState<Record<string, Result>>({});
  // Lo que la persona cambió; el resto sigue lo sugerido (las dudosas, sin tildar)
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  // Las obras a buscar se fijan al abrir: al guardar, la lista de afuera cambia
  const [list] = useState(projects);

  useEffect(() => {
    let closed = false;
    (async () => {
      for (const p of list) {
        let result: Result;
        try {
          result = await locateProject(p);
        } catch {
          result = "error";
        }
        if (closed) return;
        setResults((r) => ({ ...r, [p.id]: result }));
      }
    })();
    return () => { closed = true; };
  }, [list]);

  const done = list.filter((p) => p.id in results).length;
  const searching = done < list.length;
  const found = (p: Project) => { const r = results[p.id]; return r && r !== "error" ? r : null; };
  const isOn = (p: Project) => { const r = found(p); return !!r && (changed[p.id] ?? !r.doubt); };
  const chosen = list.filter(isOn);

  async function save() {
    const ok = await run(async () => {
      for (const p of chosen) {
        const r = found(p)!;
        await repo.updateProject(p.id, { lat: r.lat, lng: r.lng });
      }
    }, chosen.length === 1 ? "1 obra ubicada en el mapa" : `${chosen.length} obras ubicadas en el mapa`);
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ubicar las obras en el mapa</DialogTitle>
          <DialogDescription>
            Busca cada obra por su padrón en el servicio público de direcciones del Estado (IDE Uruguay) y, si no aparece, por su dirección.
            Solo se completan las que no tienen ubicación. Las dudosas vienen sin tildar: miralas antes con “Ver”.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Obra</TableHead>
                <TableHead>Padrón</TableHead>
                <TableHead>Dónde queda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((p) => {
                const r = found(p);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Checkbox
                        checked={isOn(p)}
                        disabled={!r || pending}
                        onCheckedChange={(v) => setChanged((c) => ({ ...c, [p.id]: !!v }))}
                        aria-label={`Ubicar ${p.name}`}
                      />
                    </TableCell>
                    <TableCell className="max-w-56">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.address}, {p.locality}</span>
                    </TableCell>
                    <TableCell className="tabular-nums">{p.padron || "—"}</TableCell>
                    <TableCell className="max-w-80 text-xs whitespace-normal">
                      {!(p.id in results) ? (
                        <span className="text-muted-foreground">Buscando…</span>
                      ) : results[p.id] === "error" ? (
                        <span className="text-destructive">No se pudo consultar el servicio. Probá de nuevo más tarde.</span>
                      ) : r ? (
                        <>
                          <span className="block">
                            {r.place} <span className="text-muted-foreground">({r.source === "padron" ? "por padrón" : "por dirección"})</span>
                            {" "}
                            <a href={`https://www.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground">
                              Ver <ExternalLink className="size-3" />
                            </a>
                          </span>
                          {r.doubt && <span className="block text-amber-700 dark:text-amber-400">{r.doubt}</span>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          No apareció. <Link href={`/obras/${p.id}`} className="underline underline-offset-2 hover:text-foreground">Se puede marcar a mano en la obra</Link>.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground" role="status">
            {searching ? `Buscando ${done + 1} de ${list.length}…` : `Se encontraron ${list.filter(found).length} de ${list.length}.`}
          </span>
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || searching || chosen.length === 0} onClick={save}>
            {pending ? "Guardando…" : chosen.length === 1 ? "Guardar 1 ubicación" : `Guardar ${chosen.length} ubicaciones`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
