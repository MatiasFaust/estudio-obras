"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/** Dirección vieja: los presupuestos ahora se editan dentro de Presupuestos (/pagos) */
function Redirect() {
  const { id, presupuesto } = useParams<{ id: string; presupuesto: string }>();
  const search = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (presupuesto === "nuevo") {
      const q = new URLSearchParams(search.toString());
      q.set("obra", id);
      router.replace(`/pagos/nuevo?${q.toString()}`);
    } else {
      router.replace(`/pagos/${presupuesto}`);
    }
  }, [id, presupuesto, search, router]);
  return <p className="text-sm text-muted-foreground">Cargando…</p>;
}

export default function Page() {
  return (
    <Suspense>
      <Redirect />
    </Suspense>
  );
}
