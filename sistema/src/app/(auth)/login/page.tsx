"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { ROLES } from "@/lib/constants";
import { DEMO_USERS } from "@/lib/data/demo-seed";
import { useSession } from "@/lib/data/hooks";

const DEMO_OPTIONS = [
  { id: DEMO_USERS.admin, name: "Laura Méndez", role: ROLES.admin, detail: "Acceso completo a los dos estudios" },
  { id: DEMO_USERS.arquitecto, name: "Diego Suárez", role: ROLES.arquitecto, detail: "Obras, clientes y notas" },
  { id: DEMO_USERS.colaborador, name: "Sofía Pereira", role: ROLES.colaborador, detail: "Solo obras asignadas" },
  { id: DEMO_USERS.desarrollo, name: "Martín Ferreira", role: ROLES.colaborador, detail: "Solo desarrollo: propiedades y mapa" },
];

/** Solo rutas internas, para evitar redirecciones a otros sitios */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const { repo, profile, loading, refreshSession } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && profile) router.replace(nextPath());
  }, [loading, profile, router]);

  async function enter(identifier: string, pass: string) {
    setBusy(true);
    setError(null);
    try {
      await repo.signIn(identifier, pass);
      await refreshSession();
      router.replace(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ingresar.");
    } finally {
      setBusy(false);
    }
  }

  if (repo.mode === "demo") {
    return (
      <div className="grid gap-4">
        <div>
          <h1 className="text-lg font-semibold">Demostración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Supabase todavía no está configurado. Elegí un usuario ficticio para probar el sistema con cada rol.
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <FlaskConical className="mt-0.5 size-4 shrink-0" />
          Todos los datos de la demo son ficticios y se guardan solo en este navegador.
        </div>
        <div className="grid gap-2">
          {DEMO_OPTIONS.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => enter(u.id, "")}
              className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-50"
            >
              <span>
                <span className="block text-sm font-medium">{u.name}</span>
                <span className="block text-xs text-muted-foreground">{u.detail}</span>
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{u.role}</span>
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        enter(email.trim(), password);
      }}
    >
      <div>
        <h1 className="text-lg font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acceso exclusivo para integrantes del estudio.</p>
      </div>
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? "Ingresando…" : "Ingresar"}
      </Button>
      <Link href="/recuperar" className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}
