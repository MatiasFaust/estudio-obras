"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { LogOut, Menu, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/common/brand";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ROLES } from "@/lib/constants";
import { resetDemoData } from "@/lib/data/demo-repo";
import { useSession } from "@/lib/data/hooks";
import { initials } from "@/lib/format";
import { GlobalSearch } from "./global-search";
import { SidebarNav, SidebarUser } from "./sidebar";

export function Topbar() {
  const { repo, profile } = useSession();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  async function signOut() {
    await repo.signOut();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}>
        <Menu />
      </Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <div className="px-4 pt-5 pb-4">
            <Brand />
          </div>
          <div className="flex-1 px-3">
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
          </div>
          <div className="border-t p-3">
            <SidebarUser />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
        <GlobalSearch />
      </div>

      {profile && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Perfil y opciones">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                  {initials(profile.full_name || profile.email)}
                </span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="truncate text-sm font-medium text-foreground">{profile.full_name}</div>
                <div className="truncate font-normal">{profile.email} · {ROLES[profile.role]}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Tema</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(String(v))}>
                <DropdownMenuRadioItem value="light"><Sun /> Claro</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark"><Moon /> Oscuro</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system"><Monitor /> Según el sistema</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {repo.mode === "demo" && (
              <DropdownMenuItem onClick={() => setConfirmReset(true)}>
                <RotateCcw /> Reiniciar datos de demo
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={signOut}>
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="¿Reiniciar la demostración?"
        description="Se borran los cambios hechos en la demo y se vuelven a cargar los datos ficticios originales."
        confirmLabel="Reiniciar"
        onConfirm={async () => {
          resetDemoData();
          await queryClient.invalidateQueries();
          toast.success("Datos de demostración reiniciados");
        }}
      />
    </header>
  );
}
