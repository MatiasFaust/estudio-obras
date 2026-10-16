"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AREAS, markAreaChosen, type Area } from "@/components/layout/nav";
import { useSession } from "@/lib/data/hooks";
import { hasArq, isDevMember } from "@/lib/permissions";

// Pantalla que aparece después de ingresar: dos botones para elegir el estudio.
// Si el usuario tiene acceso a uno solo, entra directo a ese.
export default function ChooseAreaPage() {
  const { repo, profile, loading } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const areas = useMemo(
    () => (Object.keys(AREAS) as Area[]).filter((a) => (a === "arquitectura" ? hasArq(profile) : isDevMember(profile))),
    [profile],
  );

  useEffect(() => {
    if (loading) return;
    if (!profile) router.replace("/login");
    else if (areas.length === 1) {
      markAreaChosen();
      router.replace(AREAS[areas[0]].home);
    }
  }, [loading, profile, router, areas]);

  async function signOut() {
    await repo.signOut();
    queryClient.clear();
    router.replace("/login");
  }

  if (loading || !profile || areas.length === 1) {
    return <p className="text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  if (areas.length === 0) {
    return (
      <div className="grid gap-3 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Tu usuario no tiene acceso a ningún estudio.</p>
        <p>Pedile a un administrador que te dé acceso.</p>
        <button type="button" onClick={signOut} className="text-xs underline-offset-4 hover:underline">Cerrar sesión</button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Hola, {profile.full_name.split(" ")[0] || profile.email}</h1>
        <p className="mt-1 text-sm text-muted-foreground">¿A qué estudio querés entrar?</p>
      </div>
      <nav aria-label="Elegir estudio" className="grid grid-cols-2 gap-3">
        {areas.map((a) => (
          <Link
            key={a}
            href={AREAS[a].home}
            onClick={markAreaChosen}
            className="grid min-h-44 content-start justify-items-center gap-2 rounded-xl border-2 bg-card px-3 pt-6 pb-5 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent/50"
          >
            <Image src={AREAS[a].logo} alt="" width={64} height={64} unoptimized loading="eager" className="size-16 rounded-full" />
            <span className="text-sm leading-tight font-semibold">{AREAS[a].label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{AREAS[a].detail}</span>
          </Link>
        ))}
      </nav>
      <button type="button" onClick={signOut} className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
        Cerrar sesión
      </button>
    </div>
  );
}
