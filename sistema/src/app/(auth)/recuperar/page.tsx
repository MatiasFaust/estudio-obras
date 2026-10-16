"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthCard } from "@/components/common/auth-card";
import { Field } from "@/components/common/field";
import { useRepo } from "@/lib/data/hooks";

export default function RecoverPage() {
  return <AuthCard><RecoverForm /></AuthCard>;
}

function RecoverForm() {
  const repo = useRepo();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await repo.requestPasswordReset(email.trim(), `${window.location.origin}/restablecer`);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el correo.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="grid gap-3 text-sm">
        <h1 className="text-lg font-semibold">Revisá tu correo</h1>
        <p className="text-muted-foreground">
          Si <strong>{email}</strong> pertenece a una cuenta del estudio, vas a recibir un enlace para crear una
          contraseña nueva. Abrilo en este mismo navegador.
        </p>
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">Volver al inicio de sesión</Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div>
        <h1 className="text-lg font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un enlace para elegir una contraseña nueva.</p>
      </div>
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</Button>
      <Link href="/login" className="text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
        Volver al inicio de sesión
      </Link>
    </form>
  );
}
