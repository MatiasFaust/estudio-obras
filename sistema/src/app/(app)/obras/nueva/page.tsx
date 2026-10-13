"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProjectForm } from "@/components/projects/project-form";
import { useSession } from "@/lib/data/hooks";
import { can } from "@/lib/permissions";

function NewProject() {
  const { profile } = useSession();
  const params = useSearchParams();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const point = params.get("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  if (!can.manageProjects(profile)) {
    return <EmptyState icon={Lock} title="Sin permiso" description="Solo arquitectos y administradores pueden crear obras." />;
  }
  return <ProjectForm initialPoint={point} />;
}

export default function NewProjectPage() {
  return (
    <>
      <Link href="/obras" className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Obras
      </Link>
      <PageHeader title="Nueva obra" description="El código único se asigna automáticamente al guardar." />
      <Suspense>
        <NewProject />
      </Suspense>
    </>
  );
}
