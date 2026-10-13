"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { useSession } from "@/lib/data/hooks";

// Se llega desde el enlace del correo de recuperación. Supabase abre la sesión
// automáticamente con el código del enlace; acá se elige la contraseña nueva.
export default function ResetPasswordPage() {
  const { repo, profile, loading } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      await repo.updatePassword(password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Verificando enlace…</p>;

  if (!profile) {
    return (
      <div className="grid gap-3 text-sm">
        <h1 className="text-lg font-semibold">Enlace no válido</h1>
        <p className="text-muted-foreground">El enlace venció o ya fue usado. Pedí uno nuevo.</p>
        <Link href="/recuperar" className="text-primary underline-offset-4 hover:underline">Solicitar otro enlace</Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div>
        <h1 className="text-lg font-semibold">Nueva contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cuenta: {profile.email}</p>
      </div>
      <Field label="Contraseña nueva" htmlFor="password" hint="Mínimo 8 caracteres.">
        <Input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="Repetir contraseña" htmlFor="confirm">
        <Input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</Button>
    </form>
  );
}
