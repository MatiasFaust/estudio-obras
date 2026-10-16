"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/data/hooks";
import { hasArq, isDevMember } from "@/lib/permissions";
import { AREAS, areaOf } from "./nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function FullPageMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-dvh place-items-center p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

/** Estructura de las pantallas privadas: exige sesión activa */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { repo, profile, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Área de la pantalla actual y si el usuario puede entrar (si no, se lo lleva a la otra)
  const area = areaOf(pathname);
  const allowed = area === "desarrollo" ? isDevMember(profile) : hasArq(profile);
  const fallback = area === "desarrollo" ? (hasArq(profile) ? AREAS.arquitectura.home : null) : (isDevMember(profile) ? AREAS.desarrollo.home : null);

  useEffect(() => {
    if (!loading && !profile) {
      router.replace(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
    } else if (profile?.active && !allowed && fallback) {
      router.replace(fallback);
    }
  }, [loading, profile, router, pathname, allowed, fallback]);

  if (loading || !profile) return <FullPageMessage>Cargando…</FullPageMessage>;

  if (!profile.active) {
    return (
      <FullPageMessage>
        <div className="grid gap-3">
          <p className="font-medium text-foreground">Tu usuario está desactivado.</p>
          <p>Pedile a un administrador del estudio que lo active.</p>
          <Button variant="outline" onClick={() => repo.signOut()}>Cerrar sesión</Button>
        </div>
      </FullPageMessage>
    );
  }

  if (!allowed) {
    if (fallback) return <FullPageMessage>Cargando…</FullPageMessage>;
    return (
      <FullPageMessage>
        <div className="grid gap-3">
          <p className="font-medium text-foreground">Tu usuario no tiene acceso a ningún estudio.</p>
          <p>Pedile a un administrador que te dé acceso.</p>
          <Button variant="outline" onClick={() => repo.signOut()}>Cerrar sesión</Button>
        </div>
      </FullPageMessage>
    );
  }

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {repo.mode === "demo" && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1 text-center text-xs text-amber-900 dark:text-amber-200">
            <FlaskConical className="size-3.5 shrink-0" />
            Modo demostración: datos ficticios guardados solo en este navegador.
          </div>
        )}
        <Topbar />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
