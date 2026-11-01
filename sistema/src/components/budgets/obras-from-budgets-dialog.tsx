"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clientFromBudget, nameKey } from "@/components/clients/budget-clients";
import { STATUS } from "@/lib/constants";
import { useAction, useRepo } from "@/lib/data/hooks";
import type { ObraProposal } from "./obras-from-budgets";

/**
 * Revisa y crea las obras que faltan. Crea obras y clientes nuevos y vincula los presupuestos:
 * no borra nada y no cambia lo que ya está cargado en las obras que existen.
 */
export function ObrasFromBudgetsDialog({ proposals, onClose }: { proposals: ObraProposal[]; onClose: () => void }) {
  const repo = useRepo();
  const { run, pending } = useAction();
  // Lo que la persona cambió; el resto sigue lo sugerido
  const [changed, setChanged] = useState<Record<string, boolean>>({});
  const isOn = (p: ObraProposal) => !p.blocked && (changed[p.key] ?? p.suggested);
  const chosen = proposals.filter(isOn);
  const toCreate = chosen.filter((p) => !p.project).length;
  const toLink = chosen.length - toCreate;

  const summary = [
    toCreate === 1 ? "1 obra creada" : toCreate ? `${toCreate} obras creadas` : "",
    toLink === 1 ? "1 obra vinculada" : toLink ? `${toLink} obras vinculadas` : "",
  ].filter(Boolean).join(" y ");

  async function create() {
    const ok = await run(async () => {
      // Dos obras del mismo cliente nuevo: el cliente se agrega una sola vez
      const added = new Map<string, string>();
      for (const p of chosen) {
        let projectId = p.project?.id;
        if (!projectId) {
          let clientId = p.client?.id ?? added.get(nameKey(p.clientName)) ?? null;
          if (!clientId && p.clientName.length >= 2) {
            clientId = (await repo.createClient(clientFromBudget(p.clientName))).id;
            added.set(nameKey(p.clientName), clientId);
          }
          projectId = (await repo.createProject({ ...p.input, client_id: clientId }, [])).id;
        }
        if (p.agreement) await repo.setFinance(projectId, p.agreement);
        for (const b of p.budgets) await repo.updateBudget(b.id, { project_id: projectId });
      }
    }, summary);
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Obras de los presupuestos y clientes</DialogTitle>
          <DialogDescription>
            Cada obra se arma con los datos de su presupuesto y su cliente. No se borra nada y a las obras que ya tenés no se les cambia lo que está cargado.
            Si un presupuesto tiene pagos, pasan a su obra y se siguen viendo en el presupuesto.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Presupuestos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow key={p.key}>
                  <TableCell>
                    <Checkbox
                      checked={isOn(p)}
                      disabled={!!p.blocked || pending}
                      onCheckedChange={(v) => setChanged((c) => ({ ...c, [p.key]: !!v }))}
                      aria-label={`${p.project ? "Vincular a" : "Crear"} ${p.input.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-60">
                    <span className="block truncate font-medium">{p.input.name}</span>
                    {p.blocked ? (
                      <span className="block text-xs whitespace-normal text-amber-700 dark:text-amber-400">{p.blocked}</span>
                    ) : (
                      <span className="block text-xs text-muted-foreground">{p.project ? "Ya existe: se vinculan los presupuestos" : "Obra nueva"}</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-44 truncate">
                    {p.clientName || "—"}
                    {!p.client && p.clientName && <span className="block text-xs text-muted-foreground">Cliente nuevo</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-52 truncate text-muted-foreground md:table-cell">
                    {(p.project ? p.project.address : p.input.address)}, {p.project ? p.project.locality : p.input.locality}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{STATUS[p.project ? p.project.status : p.input.status].label}</TableCell>
                  <TableCell className="max-w-32 truncate tabular-nums">{p.budgets.length ? p.budgets.map((b) => b.number || "Sin número").join(", ") : "Solo cliente"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Teléfono, correo, ubicación en el mapa y fechas no están en los presupuestos: esos datos se completan después en cada obra o cliente.
        </p>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || chosen.length === 0} onClick={create}>
            {pending ? "Creando…" : toLink ? `Crear ${toCreate} y vincular ${toLink}` : toCreate === 1 ? "Crear 1 obra" : `Crear ${toCreate} obras`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
