import { normalize } from "@/lib/format";
import type { Budget, Client, ClientInput, Project } from "@/lib/types";

// Los presupuestos guardan el nombre del cliente, no un vínculo con Clientes: acá se comparan
// por nombre, sin importar mayúsculas, tildes ni espacios de más.
const tidy = (name: string) => name.trim().replace(/\s+/g, " ");
const nameKey = (name: string) => normalize(tidy(name));

/** Nombres de esta lista que todavía no están en Clientes (sin repetir; también mira los archivados) */
export function missingClients(names: string[], clients: Client[]): string[] {
  const known = new Set(clients.map((c) => nameKey(c.name)));
  const out: string[] = [];
  for (const raw of names) {
    const name = tidy(raw).slice(0, 160);
    if (name.length < 2 || known.has(nameKey(name))) continue;
    known.add(nameKey(name));
    out.push(name);
  }
  return out;
}

/** Cliente nuevo a partir del nombre de un presupuesto: los demás datos se completan después */
export const clientFromBudget = (name: string): ClientInput => ({
  kind: "persona", name, document: null, phone: null, email: null, address: null, notes: null,
});

/** Presupuestos de un cliente: los de sus obras y los que llevan su nombre */
export function budgetsOfClient(client: Client, budgets: Budget[], projects: Project[]): Budget[] {
  const own = new Set(projects.filter((p) => p.client_id === client.id).map((p) => p.id));
  const key = nameKey(client.name);
  return budgets.filter((b) => (b.project_id && own.has(b.project_id)) || nameKey(b.client_name) === key);
}
