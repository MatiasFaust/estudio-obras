import { nameKey, tidy } from "@/components/clients/budget-clients";
import { normalize } from "@/lib/format";
import type { Budget, BudgetStatus, Client, Finance, FinanceInput, Payment, Profile, Project, ProjectInput, ProjectStatus, ProjectType } from "@/lib/types";
import { BUDGET_PAYING } from "./budget-status";
import { responsibleNames, sameName } from "./form-parts";

/**
 * Obras que faltan: arma cada una con los datos de sus presupuestos y de su cliente, sin tocar
 * nada todavía. Lo que no está en los presupuestos (teléfono, mapa, fechas) queda para completar.
 */
export interface ObraProposal {
  key: string;
  /** Obra que ya existe: solo se le vinculan los presupuestos. Si es null, se crea */
  project: Project | null;
  /** Datos de la obra nueva (el cliente se resuelve al crearla) */
  input: Omit<ProjectInput, "client_id">;
  client: Client | null;
  /** Nombre del cliente a agregar si todavía no está en Clientes */
  clientName: string;
  /** De la fecha más vieja a la más nueva: si hay varios aceptados, vale el último */
  budgets: Budget[];
  /** Se marca de entrada (los que solo tienen presupuestos rechazados, no) */
  suggested: boolean;
  /** Por qué no se puede vincular: hacerlo cambiaría datos de una obra que ya existe */
  blocked: string | null;
  /** Monto acordado a fijar antes de vincular, para que los pagos pasen bien a la obra */
  agreement: FinanceInput | null;
}

const padronKey = (padron: string | null | undefined) => (padron ?? "").replace(/\s/g, "").toLowerCase();

/** Del estado del presupuesto al de la obra */
const OBRA_STATUS: Record<BudgetStatus, ProjectStatus> = {
  pendiente: "anteproyecto",
  enviado: "anteproyecto",
  rechazado: "anteproyecto",
  aceptado: "planificada",
  en_ejecucion: "en_construccion",
  finalizado: "finalizada",
};
/** De menos a más avanzado: la obra toma el estado del presupuesto más avanzado */
const STATUS_RANK: BudgetStatus[] = ["rechazado", "pendiente", "enviado", "aceptado", "en_ejecucion", "finalizado"];

function typeFrom(service: string): ProjectType {
  const s = normalize(service);
  if (s.includes("reforma")) return "reforma";
  if (s.includes("ampliacion")) return "ampliacion";
  if (s.includes("edificio")) return "edificio";
  if (/\b(local|comercial)\b/.test(s)) return "comercial";
  if (/\b(industrial|galpon)\b/.test(s)) return "industrial";
  if (/\b(vivienda|casa)\b/.test(s)) return "vivienda";
  return "otro";
}

/** "padrón 6191/006 de Paysandú Chacras." → "Paysandú Chacras" */
const localityFrom = (intro: string) => intro.match(/padr[oó]n(?:es)?\s*(?:n[º°o.]*\s*)?[\d/.-]*\d\s+de\s+([^.,]+)/i)?.[1]?.trim().slice(0, 80);

/** "Obra Iturrospe": con el apellido, como las que ya tiene el estudio (las empresas, con el nombre entero) */
function baseName(client: string, isCompany: boolean, budgets: Budget[]): string {
  const last = client.split(" ").at(-1) ?? "";
  if (client) return `Obra ${!isCompany && last.length >= 3 && !last.includes(".") ? last : client}`.slice(0, 160);
  return `Obra ${budgets[0]?.number || budgets[0]?.service || "sin cliente"}`.slice(0, 160);
}

export function proposeObras({ budgets, clients, projects, finances, payments, profiles }: {
  budgets: Budget[];
  clients: Client[];
  projects: Project[];
  finances: Finance[];
  payments: Payment[];
  profiles: Profile[];
}): ObraProposal[] {
  const clientByName = new Map(clients.map((c) => [nameKey(c.name), c]));
  const taken = new Set(projects.map((p) => normalize(p.name)));
  const uniqueName = (base: string, extra: string) => {
    let name = base;
    if (taken.has(normalize(name)) && extra) name = `${base} (${extra})`.slice(0, 160);
    for (let i = 2; taken.has(normalize(name)); i++) name = `${base} (${i})`.slice(0, 160);
    taken.add(normalize(name));
    return name;
  };

  // Mismo cliente y mismo padrón = misma obra. Sin padrón, va con la única del cliente que tenga
  const loose = budgets.filter((b) => !b.project_id);
  const padronsOf = new Map<string, Set<string>>();
  for (const b of loose) {
    const pad = padronKey(b.padron);
    if (pad) padronsOf.set(nameKey(b.client_name), (padronsOf.get(nameKey(b.client_name)) ?? new Set()).add(pad));
  }
  const groups = new Map<string, Budget[]>();
  for (const b of [...loose].sort((x, y) => x.issued_on.localeCompare(y.issued_on))) {
    const who = nameKey(b.client_name);
    const only = padronsOf.get(who);
    const pad = padronKey(b.padron) || (only?.size === 1 ? [...only][0] : "");
    const key = who || pad ? `${who}|${pad}` : `|${b.id}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  const proposals: ObraProposal[] = [];
  const clientsWithObra = new Set(projects.flatMap((p) => (p.client_id ? [p.client_id] : [])));

  for (const [key, list] of groups) {
    const clientName = tidy(list[0].client_name).slice(0, 160);
    const client = clientByName.get(nameKey(clientName)) ?? null;
    const padron = list.map((b) => b.padron.trim()).find(Boolean) ?? "";
    const pad = padronKey(padron);
    // ¿Ya hay una obra? Por el padrón o, si alguno no lo tiene, por el cliente
    const project = (pad ? projects.find((p) => padronKey(p.padron) === pad) : undefined)
      ?? (client ? projects.find((p) => p.client_id === client.id && (!pad || !padronKey(p.padron))) : undefined)
      ?? null;
    if (client) clientsWithObra.add(client.id);

    const finance = project ? finances.find((f) => f.project_id === project.id) : undefined;
    const hasAgreement = finance?.agreed_amount != null;
    const ownPayments = payments.filter((p) => p.budget_id && list.some((b) => b.id === p.budget_id));
    let blocked: string | null = null;
    if (hasAgreement && list.some((b) => BUDGET_PAYING.includes(b.status) && b.price !== null && (b.price !== finance!.agreed_amount || b.currency !== finance!.currency))) {
      blocked = "La obra ya tiene otro monto acordado: vincularlo lo cambiaría.";
    } else if (hasAgreement && ownPayments.some((p) => p.currency !== finance!.currency && !p.exchange_rate)) {
      blocked = "Tiene pagos en otra moneda sin cotización.";
    }
    const priced = [...list].reverse().find((b) => b.price !== null);
    const agreement: FinanceInput | null = ownPayments.length && !hasAgreement && priced
      ? { agreed_amount: priced.price, currency: priced.currency, notes: priced.number ? `Según el presupuesto ${priced.number}.` : "Según el presupuesto." }
      : null;

    const top = STATUS_RANK[Math.max(...list.map((b) => STATUS_RANK.indexOf(b.status)))];
    const service = list.map((b) => b.service.trim()).find(Boolean) ?? "";
    const people = list.flatMap((b) => responsibleNames(b.responsible));
    proposals.push({
      key,
      project,
      client,
      clientName,
      budgets: list,
      blocked,
      agreement,
      suggested: !blocked && list.some((b) => b.status !== "rechazado"),
      input: {
        name: project ? project.name : uniqueName(baseName(clientName, client?.kind === "empresa", list), padron || list[0].number),
        address: (list.map((b) => b.address.trim()).find(Boolean) || client?.address?.trim() || (padron ? `Padrón ${padron}` : "Sin dirección")).slice(0, 200),
        locality: list.map((b) => localityFrom(b.intro)).find(Boolean) ?? "Paysandú",
        department: "Paysandú",
        padron: padron.slice(0, 30) || null,
        lat: null,
        lng: null,
        project_type: typeFrom(`${service} ${list[0].intro}`),
        description: service || null,
        responsible_id: profiles.find((u) => people.some((n) => sameName(n, u.full_name)))?.id ?? null,
        start_date: null,
        due_date: null,
        status: OBRA_STATUS[top],
      },
    });
  }

  // Clientes sin obra ni presupuestos: también quedan registrados
  for (const c of clients) {
    if (c.archived_at || clientsWithObra.has(c.id)) continue;
    proposals.push({
      key: `cliente|${c.id}`,
      project: null,
      client: c,
      clientName: c.name,
      budgets: [],
      blocked: null,
      agreement: null,
      suggested: true,
      input: {
        name: uniqueName(baseName(tidy(c.name), c.kind === "empresa", []), ""),
        address: c.address?.trim().slice(0, 200) || "Sin dirección",
        locality: "Paysandú",
        department: "Paysandú",
        padron: null,
        lat: null,
        lng: null,
        project_type: "otro",
        description: null,
        responsible_id: null,
        start_date: null,
        due_date: null,
        status: "anteproyecto",
      },
    });
  }
  return proposals;
}
