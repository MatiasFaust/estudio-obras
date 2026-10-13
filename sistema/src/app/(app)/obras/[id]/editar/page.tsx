"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Lock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { useProjects, useSession } from "@/lib/data/hooks";
import { can } from "@/lib/permissions";

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useSession();
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === id);

  if (projects.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!project) return <EmptyState icon={Building2} title="Obra no encontrada" description="No existe o no tenés acceso." />;
  if (!can.manageProjects(profile)) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Solo arquitectos y administradores pueden editar obras." />;
  }

  return (
    <>
      <Link href={`/obras/${project.id}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> {project.name}
      </Link>
      <PageHeader title="Editar obra" description={project.code} />
      <ProjectForm project={project} />
    </>
  );
}
