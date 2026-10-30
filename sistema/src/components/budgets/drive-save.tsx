"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canSaveToFolder, canWrite, chooseFolder, forgetFolder, savedFolder, writeFile, type Folder } from "./save-to-folder";

const noSubscribe = () => () => {};

/**
 * "Guardar en Drive": guarda el PDF en la carpeta de Google Drive para escritorio.
 * La primera vez explica y pide elegir la carpeta; después guarda directo.
 * `dialog` se tiene que dibujar en la pantalla que use el hook.
 */
export function useSaveToDrive() {
  // Solo en Edge y Chrome de computadora (en el servidor y en celulares, no)
  const supported = useSyncExternalStore(noSubscribe, canSaveToFolder, () => false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<{ resolve: (d: Folder | null) => void } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supported) savedFolder().then((d) => setFolderName(d?.name ?? null));
  }, [supported]);

  /** Elige otra carpeta (también la primera vez) */
  async function change(): Promise<Folder | null> {
    try {
      const dir = await chooseFolder();
      if (dir) setFolderName(dir.name);
      return dir;
    } catch {
      toast.error("No se pudo usar esa carpeta. Probá con otra (por ejemplo, una dentro de “Mi unidad”).");
      return null;
    }
  }

  async function save(fileName: string, makePdf: () => Promise<Blob>): Promise<boolean> {
    let dir = await savedFolder();
    if (!dir) {
      dir = await new Promise<Folder | null>((resolve) => setChoosing({ resolve }));
      if (!dir) return false;
    }
    setBusy(true);
    try {
      if (!(await canWrite(dir))) {
        toast.error("El navegador no dio permiso para guardar en la carpeta.");
        return false;
      }
      await writeFile(dir, fileName, await makePdf());
      toast.success(`Guardado en Drive: ${dir.name} › ${fileName}`);
      return true;
    } catch {
      // La carpeta ya no existe o no se puede escribir: la próxima vez se elige de nuevo
      await forgetFolder();
      setFolderName(null);
      toast.error("No se pudo guardar en la carpeta. Volvé a intentar y elegila de nuevo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const close = (dir: Folder | null) => {
    choosing?.resolve(dir);
    setChoosing(null);
  };

  const dialog = (
    <Dialog open={!!choosing} onOpenChange={(o) => !o && close(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar en Drive</DialogTitle>
          <DialogDescription>
            Elegí la carpeta de Google Drive donde se guardan los presupuestos: en el cuadro que se abre, entrá a
            “Google Drive (G:)” → “Mi unidad” → “Presupuestos” y apretá “Seleccionar carpeta”. Se elige una sola vez.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)}>Cancelar</Button>
          <Button onClick={async () => close(await change())}><FolderOpen /> Elegir carpeta</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { supported, folderName, busy, save, change, dialog };
}
