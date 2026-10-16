"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/common/auth-card";
import { Field } from "@/components/common/field";
import { AREAS, areaOf, type Area } from "@/components/layout/nav";
import { ROLES } from "@/lib/constants";
import { DEMO_USERS } from "@/lib/data/demo-seed";
import { useSession } from "@/lib/data/hooks";
import { cn } from "@/lib/utils";

const DEMO_OPTIONS = [
  { id: DEMO_USERS.admin, name: "Laura Méndez", role: ROLES.admin, detail: "Acceso completo a los dos estudios" },
  { id: DEMO_USERS.arquitecto, name: "Diego Suárez", role: ROLES.arquitecto, detail: "Obras, clientes y notas" },
  { id: DEMO_USERS.colaborador, name: "Sofía Pereira", role: ROLES.colaborador, detail: "Solo obras asignadas" },
  { id: DEMO_USERS.desarrollo, name: "Martín Ferreira", role: ROLES.colaborador, detail: "Solo desarrollo: propiedades y mapa" },
];

const AREA_KEY = "estudio-area";
const AREA_DETAIL: Record<Area, string> = { arquitectura: "Obras, clientes y presupuestos", desarrollo: "Casas y terrenos en alquiler" };

/** Página a la que se quería entrar antes de iniciar sesión (solo rutas internas, para evitar redirecciones a otros sitios) */
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

/** Estudio elegido al entrar: el de la página pedida o el último que se usó */
function storedArea(): Area {
  const next = nextPath();
  if (next) return areaOf(next);
  try {
    return localStorage.getItem(AREA_KEY) === "desarrollo" ? "desarrollo" : "arquitectura";
  } catch {
    return "arquitectura";
  }
}

/** Adónde ir al entrar: la página pedida si es del estudio elegido; si no, el inicio de ese estudio */
function destination(area: Area): string {
  const next = nextPath();
  return next && areaOf(next) === area ? next : AREAS[area].home;
}

/** Los dos cuadros para elegir a qué estudio entrar */
function AreaPicker({ value, onChange }: { value: Area; onChange: (a: Area) => void }) {
  return (
    <div role="radiogroup" aria-label="¿A qué estudio querés entrar?" className="mb-4 grid grid-cols-2 gap-3">
      {(Object.keys(AREAS) as Area[]).map((a) => {
        const on = a === value;
        return (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(a)}
            className={cn(
              "grid min-h-28 content-start justify-items-center gap-1.5 rounded-xl border-2 bg-card px-3 py-4 text-center shadow-sm transition-colors",
              on ? "bg-accent/60" : "border-border opacity-75 hover:border-foreground/30 hover:opacity-100",
            )}
            style={on ? { borderColor: AREAS[a].color } : undefined}
          >
            <Image src={AREAS[a].logo} alt="" width={56} height={56} unoptimized loading="eager" className="size-14 rounded-full" />
            <span className="text-sm leading-tight font-semibold">{AREAS[a].label}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{AREA_DETAIL[a]}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const { repo, profile, loading, refreshSession } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<Area>("arquitectura");

  // La elección guardada se lee después de cargar la página (en el servidor no hay localStorage)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor inicial que solo existe en el navegador
    setArea(storedArea());
  }, []);

  useEffect(() => {
    if (!loading && profile) router.replace(destination(storedArea()));
  }, [loading, profile, router]);

  async function enter(identifier: string, pass: string) {
    setBusy(true);
    setError(null);
    try {
      await repo.signIn(identifier, pass);
      try {
        localStorage.setItem(AREA_KEY, area);
      } catch {
        /* sin almacenamiento: no se recuerda la elección */
      }
      await refreshSession();
      router.replace(destination(area));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ingresar.");
    } finally {
      setBusy(false);
    }
  }

  const body = repo.mode === "demo" ? (
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
  ) : (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        enter(email.trim(), password);
      }}
    >
      <div>
        <h1 className="text-lg font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-muted-foreground">Entrás al {AREAS[area].label.toLowerCase()}. Acceso exclusivo para integrantes.</p>
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

  return (
    <>
      <AreaPicker value={area} onChange={setArea} />
      <AuthCard>{body}</AuthCard>
    </>
  );
}
