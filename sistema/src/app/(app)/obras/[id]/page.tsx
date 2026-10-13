"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Archive, ArchiveRestore, ArrowLeft, Building2, ExternalLink, MoreHorizontal, Pencil, Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList } from "@/components/common/activity-list";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ProgressBar } from "@/components/common/progress-bar";
import { SimpleSelect } from "@/components/common/simple-select";
import { StatusBadge } from "@/components/common/status-badge";
import { ProjectsMap } from "@/components/map";
import { NotesPanel } from "@/components/notes/notes-panel";
import { StagesPanel } from "@/components/projects/stages-panel";
import { PROJECT_TYPES, ROLES, SELECTABLE_STATUS, STATUS } from "@/lib/constants";
import { useAction, useClients, useMembers, useNotes, useProfiles, useProjects, useRepo, useSession } from "@/lib/data/hooks";
import { formatDate, googleMapsUrl, isOverdue } from "@/lib/format";
import { can } from "@/lib/permissions";
import type { ProjectStatus } from "@/lib/types";

const TABS = ["resumen", "etapas", "notas", "historial"] as const;
const STATUS_OPTIONS = SELECTABLE_STATUS.map((s) => ({ value: s, label: STATUS[s].label }));

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const repo = useRepo();
  const { profile } = useSession();
  const { run } = useAction();
  const projects = useProjects();
  const clients = useClients();
  const profiles = useProfiles();
  const members = useMembers(id);
  const notes = useNotes();
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);

  const initialTab = TABS.find((t) => t === search.get("tab")) ?? "resumen";
  const [tab, setTab] = useState<string>(initialTab);

  const project = projects.data?.find((p) => p.id === id);
  if (projects.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!project) {
    return (
      <EmptyState icon={Building2} title="Obra no encontrada" description="No existe o no tenés acceso."
        action={<Link href="/obras" className="text-sm text-primary">Volver a obras</Link>} />
    );
  }

  const client = clients.data?.find((c) => c.id === project.client_id);
  const person = (pid: string | null) => profiles.data?.find((p) => p.id === pid);
  const responsible = person(project.responsible_id);
  const team = (members.data ?? []).map((m) => person(m)).filter(Boolean);
  const openNotes = (notes.data ?? []).filter((n) => n.project_id === project.id && !n.resolved_at).length;
  const archived = project.status === "archivada";
  const manage = can.manageProjects(profile);
  const late = isOverdue(project.due_date) && !["finalizada", "archivada"].includes(project.status);

  return (
    <>
      <Link href="/obras" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Obras
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{project.code}</span>·<span>{PROJECT_TYPES[project.project_type]}</span>
          </div>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.address}, {project.locality} ({project.department})</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {manage && !archived ? (
            <SimpleSelect
              value={project.status}
              onChange={(s) => run(() => repo.setProjectStatus(project.id, s as ProjectStatus), `Estado: ${STATUS[s as ProjectStatus].label}`)}
              options={STATUS_OPTIONS}
              className="w-48"
              aria-label="Cambiar estado"
            />
          ) : (
            <StatusBadge status={project.status} />
          )}
          {manage && (
            <Link href={`/obras/${project.id}/editar`} className={buttonVariants({ variant: "outline" })}><Pencil /> Editar</Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="Más acciones"><MoreHorizontal /></Button>} />
            <DropdownMenuContent align="end" className="w-52">
              {project.lat !== null && project.lng !== null && (
                <DropdownMenuItem onClick={() => window.open(googleMapsUrl(project.lat!, project.lng!), "_blank", "noopener")}>
                  <ExternalLink /> Abrir en Google Maps
                </DropdownMenuItem>
              )}
              {manage && (archived ? (
                <DropdownMenuItem onClick={() => run(() => repo.restoreProject(project.id), "Obra restaurada")}>
                  <ArchiveRestore /> Restaurar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setConfirm("archive")}><Archive /> Archivar</DropdownMenuItem>
              ))}
              {can.deleteProjects(profile) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}><Trash2 /> Eliminar definitivamente</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
        <TabsList variant="line" className="mb-3 border-b">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="etapas">Etapas y avance</TabsTrigger>
          <TabsTrigger value="notas">Notas{openNotes ? ` (${openNotes})` : ""}</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              <Card size="sm">
                <CardHeader><CardTitle>Información general</CardTitle></CardHeader>
                <CardContent>
                  <dl className="divide-y">
                    <Info label="Estado"><StatusBadge status={project.status} /></Info>
                    <Info label="Avance"><ProgressBar value={project.progress} className="max-w-60" /></Info>
                    <Info label="Cliente">
                      {client ? <Link href={`/clientes/${client.id}`} className="text-primary hover:underline">{client.name}</Link> : "—"}
                    </Info>
                    <Info label="Responsable">{responsible ? `${responsible.full_name} · ${ROLES[responsible.role]}` : "—"}</Info>
                    <Info label="Inicio">{formatDate(project.start_date)}</Info>
                    <Info label="Fin previsto">
                      <span className={late ? "font-medium text-destructive" : undefined}>{formatDate(project.due_date)}{late && " · vencida"}</span>
                    </Info>
                    <Info label="Padrón">{project.padron ?? "—"}</Info>
                    <Info label="Colaboradores">{team.length ? team.map((p) => p!.full_name).join(", ") : "—"}</Info>
                  </dl>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader><CardTitle>Descripción</CardTitle></CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {project.description || "Sin descripción."}
                </CardContent>
              </Card>
            </div>
            <Card size="sm" className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ubicación</CardTitle>
                {project.lat !== null && project.lng !== null && (
                  <a href={googleMapsUrl(project.lat, project.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    Google Maps <ExternalLink className="size-3" />
                  </a>
                )}
              </CardHeader>
              <CardContent>
                {project.lat !== null && project.lng !== null ? (
                  <div className="isolate h-80 overflow-hidden rounded-lg border">
                    <ProjectsMap projects={[project]} clients={clients.data ?? []} selectedId={project.id} fitKey={project.id} className="h-full w-full" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">La obra no tiene ubicación en el mapa. {manage && <Link href={`/obras/${project.id}/editar`} className="text-primary hover:underline">Agregarla</Link>}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="etapas"><StagesPanel project={project} /></TabsContent>
        <TabsContent value="notas"><NotesPanel projectId={project.id} /></TabsContent>
        <TabsContent value="historial">
          <Card size="sm"><CardContent><ActivityList projectId={project.id} limit={100} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirm === "archive"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Archivar la obra?"
        description="Deja de aparecer en el mapa y en los listados, pero conserva toda su información. Se puede restaurar en cualquier momento."
        confirmLabel="Archivar"
        destructive={false}
        onConfirm={() => run(() => repo.archiveProject(project.id), "Obra archivada")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Eliminar la obra definitivamente?"
        description={<>Se borrarán <strong>{project.name}</strong>, sus etapas y sus notas. Esta acción no se puede deshacer. Si solo querés quitarla de la vista, usá Archivar.</>}
        onConfirm={async () => {
          const ok = await run(() => repo.deleteProject(project.id), "Obra eliminada");
          if (ok) router.replace("/obras");
          return ok;
        }}
      />
    </>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense>
      <ProjectDetail />
    </Suspense>
  );
}
