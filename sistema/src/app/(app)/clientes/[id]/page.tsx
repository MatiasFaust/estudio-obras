"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Building2, Mail, MapPin, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientDialog } from "@/components/clients/client-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "@/components/common/status-badge";
import { useAction, useClients, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const repo = useRepo();
  const { profile } = useSession();
  const { run } = useAction();
  const clients = useClients();
  const projects = useProjects();
  const [editing, setEditing] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const client = clients.data?.find((c) => c.id === id);
  const own = (projects.data ?? []).filter((p) => p.client_id === id);

  if (clients.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!client) {
    return <EmptyState icon={Building2} title="Cliente no encontrado" description="No existe o no tenés acceso." action={<Link href="/clientes" className="text-sm text-primary">Volver a clientes</Link>} />;
  }

  const archived = !!client.archived_at;

  return (
    <>
      <Link href="/clientes" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Clientes
      </Link>
      <PageHeader
        title={<span className="flex items-center gap-2">{client.name}{archived && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal">Archivado</span>}</span>}
        description={client.kind === "empresa" ? "Empresa" : "Persona"}
        actions={can.manageClients(profile) && (
          <>
            <Button variant="outline" onClick={() => setEditing(Date.now())}><Pencil /> Editar</Button>
            {archived ? (
              <Button variant="outline" onClick={() => run(() => repo.setClientArchived(client.id, false), "Cliente restaurado")}>
                <ArchiveRestore /> Restaurar
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setConfirm("archive")}><Archive /> Archivar</Button>
            )}
            {can.deleteClients(profile) && (
              <Button variant="destructive" onClick={() => setConfirm("delete")}><Trash2 /> Eliminar</Button>
            )}
          </>
        )}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid content-start gap-4">
          <Card size="sm">
            <CardHeader><CardTitle>Datos de contacto</CardTitle></CardHeader>
            <CardContent className="grid gap-2.5 text-sm">
              <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">{client.kind === "empresa" ? "RUT" : "Cédula"}</span>{client.document ?? "—"}</div>
              <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" />
                {client.phone ? <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="hover:underline">{client.phone}</a> : "—"}
              </div>
              <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" />
                {client.email ? <a href={`mailto:${client.email}`} className="truncate hover:underline">{client.email}</a> : "—"}
              </div>
              <div className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-muted-foreground" />{client.address ?? "—"}</div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader><CardTitle>Observaciones internas</CardTitle></CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
              {client.notes || "Sin observaciones."}
            </CardContent>
          </Card>
        </div>

        <Card size="sm">
          <CardHeader><CardTitle>Obras ({own.length})</CardTitle></CardHeader>
          <CardContent>
            {own.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este cliente todavía no tiene obras.</p>
            ) : (
              <ul className="divide-y">
                {own.map((p) => (
                  <li key={p.id}>
                    <Link href={`/obras/${p.id}`} className="grid gap-1.5 py-2.5 hover:bg-muted/40 sm:grid-cols-[1fr_auto_140px] sm:items-center sm:gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.code} · {p.address} · fin {formatDate(p.due_date)}</div>
                      </div>
                      <StatusBadge status={p.status} />
                      <ProgressBar value={p.progress} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && <ClientDialog key={editing} open onOpenChange={(o) => !o && setEditing(null)} client={client} />}

      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Archivar el cliente?"
        description="Deja de aparecer en el listado y en el formulario de obras. Sus datos y obras se conservan y se puede restaurar."
        confirmLabel="Archivar"
        destructive={false}
        onConfirm={() => run(() => repo.setClientArchived(client.id, true), "Cliente archivado")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Eliminar el cliente definitivamente?"
        description={own.length ? "Este cliente tiene obras vinculadas: no se puede eliminar. Podés archivarlo." : "Esta acción no se puede deshacer. Si solo querés ocultarlo, usá Archivar."}
        onConfirm={async () => {
          const ok = await run(() => repo.deleteClient(client.id), "Cliente eliminado");
          if (ok) router.replace("/clientes");
          return ok;
        }}
      />
    </>
  );
}
