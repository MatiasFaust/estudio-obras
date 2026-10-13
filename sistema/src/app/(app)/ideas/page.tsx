"use client";

import { PageHeader } from "@/components/common/page-header";
import { NotesPanel } from "@/components/notes/notes-panel";

export default function IdeasPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Ideas del estudio"
        description="Ideas, pendientes y observaciones generales que todavía no pertenecen a ninguna obra. Todo el equipo puede verlas."
      />
      <NotesPanel projectId={null} />
    </div>
  );
}
