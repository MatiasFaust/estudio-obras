// Guardar los PDF de presupuestos directo en una carpeta de la compu: la de Google Drive para
// escritorio, que los sube sola a Drive. Usa la API de archivos de Edge y Chrome (no anda en
// celulares ni en Firefox): la carpeta se elige una vez y queda recordada en este navegador.

type Permission = { mode: "read" | "readwrite" };
export interface Folder extends FileSystemDirectoryHandle {
  queryPermission(o: Permission): Promise<PermissionState>;
  requestPermission(o: Permission): Promise<PermissionState>;
}

declare global {
  interface Window {
    showDirectoryPicker(o?: { id?: string; mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }
}

const DB = "estudio-carpetas";
const STORE = "carpetas";
const KEY = "presupuestos";
// También en memoria, por si el navegador no deja guardarla (ventana privada)
let memory: Folder | null = null;

export const canSaveToFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      try {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => { db.close(); resolve(req.result as T); };
        req.onerror = () => { db.close(); reject(req.error); };
      } catch (e) {
        db.close();
        reject(e);
      }
    };
  });
}

/** Carpeta elegida antes en este navegador (o null) */
export async function savedFolder(): Promise<Folder | null> {
  if (memory) return memory;
  try {
    memory = (await idb<Folder | undefined>("readonly", (s) => s.get(KEY))) ?? null;
  } catch {
    // Sin IndexedDB: se vuelve a preguntar
  }
  return memory;
}

/** Abre el cuadro para elegir la carpeta. null si se cancela */
export async function chooseFolder(): Promise<Folder | null> {
  let dir: Folder;
  try {
    dir = (await window.showDirectoryPicker({ id: "presupuestos", mode: "readwrite" })) as Folder;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
  memory = dir;
  try {
    await idb("readwrite", (s) => s.put(dir, KEY));
  } catch {
    // Queda recordada solo mientras la página esté abierta
  }
  return dir;
}

/** Olvida la carpeta (si la borraron o la movieron, la próxima vez se elige de nuevo) */
export async function forgetFolder() {
  memory = null;
  try {
    await idb("readwrite", (s) => s.delete(KEY));
  } catch {
    // Nada que borrar
  }
}

/** Permiso para escribir: el navegador lo pregunta (se puede permitir "siempre") */
export async function canWrite(dir: Folder): Promise<boolean> {
  const opts = { mode: "readwrite" } as const;
  if ((await dir.queryPermission(opts)) === "granted") return true;
  return (await dir.requestPermission(opts)) === "granted";
}

/** Guarda el archivo en la carpeta (si ya existe uno con ese nombre, lo reemplaza) */
export async function writeFile(dir: Folder, name: string, blob: Blob) {
  const file = await dir.getFileHandle(name, { create: true });
  const out = await file.createWritable();
  await out.write(blob);
  await out.close();
}
