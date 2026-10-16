/** Recuadro de las pantallas de ingreso y recuperación de contraseña */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>;
}
