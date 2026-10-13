import { Suspense } from "react";
import { AppShell, FullPageMessage } from "@/components/layout/app-shell";

// Las pantallas privadas dependen de la sesión y de la URL: se resuelven en el navegador.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<FullPageMessage>Cargando…</FullPageMessage>}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
