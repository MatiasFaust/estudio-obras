import { STATUS } from "../constants";
import { convertAmount, formatMoney } from "../format";
import { isLeaseActive, leaseLastDay } from "../dev";
import { hasArq, isAdmin, isDevAdmin, isDevMember, isStaff } from "../permissions";
import type {
  Activity, Budget, Client, Currency, DevLease, DevProperty, DevTenant, FinanceInput, Note, Payment, Profile, Project, ProjectStatus, Stage,
} from "../types";
import { createBudgetDemoData, createDemoData, createDevDemoData, DEMO_PROFILES, type DemoDB } from "./demo-seed";
import { RepoError, type Repo } from "./repo";

// Modo demostración: los datos ficticios se guardan en el navegador (localStorage)
// y se aplican las mismas reglas que en la base de datos real.

const DB_KEY = "estudio-demo-db-v1";
const USER_KEY = "estudio-demo-user";
const CHANGE_EVENT = "estudio-demo-change";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const deny = (): never => {
  throw new RepoError("No tenés permiso para realizar esta acción.");
};

function load(): DemoDB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw) as DemoDB;
      // Datos guardados antes de existir el módulo de pagos
      db.finances ??= [];
      db.payments ??= [];
      // ...y antes de existir el estudio de desarrollo
      if (!db.devProperties) {
        Object.assign(db, createDevDemoData());
        for (const demo of DEMO_PROFILES) {
          const p = db.profiles.find((x) => x.id === demo.id);
          if (p) Object.assign(p, { arquitectura: demo.arquitectura, desarrollo: demo.desarrollo });
          else db.profiles.push({ ...demo, created_at: now() });
        }
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
      // ...y antes de existir los presupuestos en PDF y su calculadora
      if (!db.budgets) {
        Object.assign(db, createBudgetDemoData());
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      } else if (db.budgets.some((b) => !b.kind || (b.status as string) === "borrador")) {
        for (const b of db.budgets) {
          if (!b.kind) {
            const p = db.projects.find((x) => x.id === b.project_id);
            Object.assign(b, {
              kind: "membretado",
              client_name: p?.client_id ? db.clients.find((c) => c.id === p.client_id)?.name ?? "" : "",
              padron: p?.padron ?? "", address: p?.address ?? "", service: "",
            });
          }
          if ((b.status as string) === "borrador") b.status = "pendiente";
        }
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
      if (!db.budgetSettings.calc_types) {
        const { calc_types, wage_value, expenses_fixed, expenses_per_m2, iva_rate } = createBudgetDemoData().budgetSettings;
        Object.assign(db.budgetSettings, { calc_types, wage_value, expenses_fixed, expenses_per_m2, iva_rate });
        localStorage.setItem(DB_KEY, JSON.stringify(db));
      }
      return db;
    }
  } catch {
    /* almacenamiento no disponible o dañado */
  }
  const db = createDemoData();
  save(db);
  return db;
}

function save(db: DemoDB) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    throw new RepoError("No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).");
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function resetDemoData() {
  localStorage.removeItem(DB_KEY);
  load();
}

function currentUser(db: DemoDB): Profile | null {
  let id: string | null = null;
  try {
    id = localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
  const p = db.profiles.find((x) => x.id === id);
  return p && p.active ? p : null;
}

function requireUser(db: DemoDB): Profile {
  const u = currentUser(db);
  if (!u) throw new RepoError("La sesión expiró. Volvé a ingresar.");
  return u;
}

function canAccessProject(db: DemoDB, user: Profile, projectId: string | null): boolean {
  if (!projectId || !hasArq(user)) return false;
  return isStaff(user) || db.members.some((m) => m.project_id === projectId && m.user_id === user.id);
}

/** Monto acordado de una obra (lo usan setFinance y los presupuestos aceptados) */
function writeFinance(db: DemoDB, user: Profile, projectId: string, input: FinanceInput) {
  const p = findProject(db, projectId);
  const existing = db.finances.find((f) => f.project_id === projectId);
  const currencyChanged = existing && existing.currency !== input.currency;
  if (currencyChanged || !existing) {
    // Igual que la base: si un pago está en otra moneda y no tiene cotización, no se puede convertir
    for (const pay of db.payments.filter((x) => x.project_id === projectId)) {
      paymentInContract(pay.amount, pay.currency, pay.exchange_rate, input.currency);
    }
  }
  if (existing) Object.assign(existing, input, { updated_at: now() });
  else db.finances.push({ project_id: projectId, ...input, updated_at: now() });
  if (currencyChanged || !existing) {
    for (const pay of db.payments.filter((x) => x.project_id === projectId)) {
      pay.amount_contract = paymentInContract(pay.amount, pay.currency, pay.exchange_rate, input.currency);
    }
  }
  log(db, user, {
    entity_type: "payment", entity_id: projectId, project_id: projectId, action: "agreed",
    summary: `fijó el monto acordado de ${label(p)} en ${input.agreed_amount === null ? "sin monto" : formatMoney(input.agreed_amount, input.currency)}`,
  });
}

/** Presupuesto aceptado → su precio pasa a ser el monto acordado de la obra */
function acceptBudget(db: DemoDB, user: Profile, b: Budget) {
  if (!b.project_id || b.price === null || !["aceptado", "en_ejecucion", "finalizado"].includes(b.status)) return;
  writeFinance(db, user, b.project_id, {
    agreed_amount: b.price,
    currency: b.currency,
    notes: b.number ? `Según el presupuesto ${b.number}, aceptado.` : "Según el presupuesto aceptado.",
  });
}

const budgetLabel = (b: Pick<Budget, "number">) => (b.number ? `el presupuesto ${b.number}` : "un presupuesto");
/** Obra o cliente del presupuesto, para el historial */
const budgetPlace = (db: DemoDB, b: Budget) => {
  const p = b.project_id ? db.projects.find((x) => x.id === b.project_id) : undefined;
  return p ? label(p) : b.client_name || "sin obra";
};

/** Obra o presupuesto (sin obra) de un pago: lugar para el historial y moneda acordada */
function paymentOwner(db: DemoDB, pay: Pick<Payment, "project_id" | "budget_id">, fallback: Currency) {
  if (!pay.project_id === !pay.budget_id) throw new RepoError("El pago tiene que ser de una obra o de un presupuesto.");
  if (pay.project_id) {
    const p = findProject(db, pay.project_id);
    return { place: label(p), target: db.finances.find((f) => f.project_id === p.id)?.currency ?? fallback };
  }
  const b = db.budgets.find((x) => x.id === pay.budget_id);
  if (!b) throw new RepoError("El presupuesto no existe.");
  return { place: `${budgetLabel(b)}${b.client_name ? ` (${b.client_name})` : ""}`, target: b.currency };
}

/** Igual que la base: presupuesto vinculado a una obra → sus pagos pasan a la obra; si cambia su moneda, se recalculan */
function moveBudgetPayments(db: DemoDB, before: Budget, b: Budget) {
  const own = db.payments.filter((x) => x.budget_id === b.id);
  const linked = !before.project_id && !!b.project_id;
  if (!linked && before.currency === b.currency) return;
  const target = linked ? db.finances.find((f) => f.project_id === b.project_id)?.currency : b.currency;
  for (const pay of own) {
    pay.amount_contract = target ? paymentInContract(pay.amount, pay.currency, pay.exchange_rate, target) : pay.amount;
    if (linked) Object.assign(pay, { project_id: b.project_id, budget_id: null });
  }
}

/** Mismas validaciones que la base */
function checkBudget(b: Partial<Budget>) {
  const neg = (n: number | null | undefined) => n !== null && n !== undefined && n < 0;
  if (neg(b.price) || neg(b.expenses_amount) || neg(b.wages_amount) || neg(b.wages_days)) {
    throw new RepoError("Algún dato no cumple las validaciones.");
  }
}

function requireDevAdmin(db: DemoDB): Profile {
  const user = requireUser(db);
  if (!isDevAdmin(user)) deny();
  return user;
}

function findDev<T extends { id: string }>(list: T[], id: string, message: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new RepoError(message);
  return item;
}

/** Mismas validaciones que la base: fechas coherentes y sin contratos superpuestos */
function checkLease(db: DemoDB, l: DevLease) {
  findDev(db.devProperties, l.property_id, "La propiedad no existe.");
  findDev(db.devTenants, l.tenant_id, "El inquilino no existe.");
  if (!(l.rent_amount > 0) || (l.end_date && l.end_date < l.start_date) || (l.terminated_on && l.terminated_on < l.start_date)) {
    throw new RepoError("Algún dato no cumple las validaciones.");
  }
  const lastOf = (x: DevLease) => leaseLastDay(x) ?? "9999-12-31";
  const overlap = db.devLeases.some(
    (o) => o.property_id === l.property_id && o.id !== l.id && o.start_date <= lastOf(l) && l.start_date <= lastOf(o),
  );
  if (overlap) throw new RepoError("La propiedad ya tiene un contrato en esas fechas");
}

/** La casa pasa a "alquilada" con un contrato vigente y a "desocupada" cuando termina */
function syncPropertyStatus(db: DemoDB, propertyId: string) {
  const p = db.devProperties.find((x) => x.id === propertyId);
  if (!p) return;
  if (db.devLeases.some((l) => l.property_id === propertyId && isLeaseActive(l))) p.status = "alquilada";
  else if (p.status === "alquilada") p.status = "desocupada";
}

function computeProgress(db: DemoDB, p: Project): number {
  if (p.progress_mode === "manual") return p.manual_progress ?? 0;
  const stages = db.stages.filter((s) => s.project_id === p.id);
  const total = stages.reduce((a, s) => a + s.weight, 0);
  return total ? Math.round(stages.reduce((a, s) => a + s.weight * s.progress, 0) / total) : 0;
}

function refreshProgress(db: DemoDB, projectId: string) {
  const p = db.projects.find((x) => x.id === projectId);
  if (p) p.progress = computeProgress(db, p);
}

function log(db: DemoDB, actor: Profile, a: Omit<Activity, "id" | "actor_id" | "actor_name" | "created_at">) {
  db.activity.unshift({
    ...a,
    id: (db.activity[0]?.id ?? 0) + 1,
    actor_id: actor.id,
    actor_name: actor.full_name,
    created_at: now(),
  });
  db.activity = db.activity.slice(0, 500);
}

const label = (p: Project) => `${p.code} · ${p.name}`;

/** Igual que la función convert_payment de la base */
function paymentInContract(amount: number, currency: Currency, rate: number | null, target: Currency): number {
  const converted = convertAmount(amount, currency, target, rate);
  if (converted === null) throw new RepoError(`Falta la cotización para convertir ${currency} a ${target}`);
  return converted;
}

function findProject(db: DemoDB, id: string): Project {
  const p = db.projects.find((x) => x.id === id);
  if (!p) throw new RepoError("La obra no existe.");
  return p;
}

function nextCode(db: DemoDB): string {
  const year = new Date().getFullYear();
  const prefix = `OB-${year}-`;
  const max = db.projects
    .filter((p) => p.code.startsWith(prefix))
    .reduce((m, p) => Math.max(m, Number(p.code.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Cambios de obra con el mismo historial que el trigger de la base */
function applyProjectUpdate(db: DemoDB, user: Profile, p: Project, changes: Partial<Project>) {
  const before = { ...p };
  if (changes.status === "archivada" && p.status !== "archivada") p.status_before_archive = p.status;
  Object.assign(p, changes, { updated_at: now() });
  p.progress = computeProgress(db, p);

  if (p.status !== before.status) {
    if (p.status === "archivada") {
      log(db, user, { entity_type: "project", entity_id: p.id, project_id: p.id, action: "archived", summary: `archivó la obra ${label(p)}` });
    } else if (before.status === "archivada") {
      log(db, user, { entity_type: "project", entity_id: p.id, project_id: p.id, action: "restored", summary: `restauró la obra ${label(p)}` });
    } else {
      log(db, user, {
        entity_type: "project", entity_id: p.id, project_id: p.id, action: "status",
        summary: `cambió el estado de ${label(p)}: ${STATUS[before.status].label} → ${STATUS[p.status].label}`,
      });
    }
  } else if (p.progress_mode === "manual" && p.manual_progress !== before.manual_progress) {
    log(db, user, { entity_type: "project", entity_id: p.id, project_id: p.id, action: "progress", summary: `ajustó manualmente el avance de ${label(p)} a ${p.manual_progress}%` });
  } else {
    const keys: (keyof Project)[] = ["name", "client_id", "address", "locality", "padron", "lat", "lng", "project_type", "description", "responsible_id", "start_date", "due_date", "progress_mode"];
    if (keys.some((k) => p[k] !== before[k])) {
      log(db, user, { entity_type: "project", entity_id: p.id, project_id: p.id, action: "updated", summary: `actualizó la obra ${label(p)}` });
    }
  }
}

function notePlace(db: DemoDB, n: Pick<Note, "project_id">): string {
  if (!n.project_id) return "en Ideas del estudio";
  const p = db.projects.find((x) => x.id === n.project_id);
  return p ? `en ${label(p)}` : "";
}

export function createDemoRepo(): Repo {
  return {
    mode: "demo",

    async getCurrentProfile() {
      return currentUser(load());
    },
    /** En la demo se ingresa eligiendo un usuario ficticio (el "correo" es su id) */
    async signIn(userId) {
      const db = load();
      const p = db.profiles.find((x) => x.id === userId && x.active);
      if (!p) throw new RepoError("Usuario de demostración no válido.");
      localStorage.setItem(USER_KEY, p.id);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    async signOut() {
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    async requestPasswordReset() {
      throw new RepoError("La recuperación de contraseña funciona con Supabase configurado. En la demo no hay contraseñas.");
    },
    async updatePassword() {
      throw new RepoError("En la demo no hay contraseñas.");
    },
    onAuthChange(cb) {
      window.addEventListener(CHANGE_EVENT, cb);
      return () => window.removeEventListener(CHANGE_EVENT, cb);
    },

    async listProfiles() {
      const db = load();
      const user = requireUser(db);
      return db.profiles
        .filter((p) => p.id === user.id || hasArq(user) || isDevMember(user))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },

    // ---------------- Clientes ----------------
    async listClients() {
      const db = load();
      const user = requireUser(db);
      const visible = isStaff(user)
        ? db.clients
        : db.clients.filter((c) => db.projects.some((p) => p.client_id === c.id && canAccessProject(db, user, p.id)));
      return [...visible].sort((a, b) => a.name.localeCompare(b.name));
    },
    async createClient(input) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const c: Client = { ...input, id: uid(), archived_at: null, created_by: user.id, created_at: now(), updated_at: now() };
      db.clients.push(c);
      log(db, user, { entity_type: "client", entity_id: c.id, project_id: null, action: "created", summary: `registró el cliente ${c.name}` });
      save(db);
      return c;
    },
    async updateClient(id, input) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const c = db.clients.find((x) => x.id === id);
      if (!c) throw new RepoError("El cliente no existe.");
      Object.assign(c, input, { updated_at: now() });
      log(db, user, { entity_type: "client", entity_id: c.id, project_id: null, action: "updated", summary: `actualizó el cliente ${c.name}` });
      save(db);
      return c;
    },
    async setClientArchived(id, archived) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const c = db.clients.find((x) => x.id === id);
      if (!c) throw new RepoError("El cliente no existe.");
      c.archived_at = archived ? now() : null;
      c.updated_at = now();
      log(db, user, {
        entity_type: "client", entity_id: c.id, project_id: null, action: archived ? "archived" : "restored",
        summary: `${archived ? "archivó" : "restauró"} el cliente ${c.name}`,
      });
      save(db);
    },
    async deleteClient(id) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const c = db.clients.find((x) => x.id === id);
      if (!c) throw new RepoError("El cliente no existe.");
      if (db.projects.some((p) => p.client_id === id)) {
        throw new RepoError("No se puede eliminar: hay registros vinculados (por ejemplo, obras de este cliente).");
      }
      db.clients = db.clients.filter((x) => x.id !== id);
      log(db, user, { entity_type: "client", entity_id: id, project_id: null, action: "deleted", summary: `eliminó el cliente ${c.name}` });
      save(db);
    },

    // ---------------- Obras ----------------
    async listProjects() {
      const db = load();
      const user = requireUser(db);
      return db.projects
        .filter((p) => canAccessProject(db, user, p.id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createProject(input, memberIds) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const p: Project = {
        ...input,
        id: uid(),
        code: nextCode(db),
        status_before_archive: null,
        progress_mode: "etapas",
        manual_progress: null,
        progress: 0,
        created_by: user.id,
        created_at: now(),
        updated_at: now(),
      };
      db.projects.push(p);
      memberIds.forEach((user_id) => db.members.push({ project_id: p.id, user_id }));
      log(db, user, { entity_type: "project", entity_id: p.id, project_id: p.id, action: "created", summary: `creó la obra ${label(p)}` });
      save(db);
      return p;
    },
    async updateProject(id, input) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const p = findProject(db, id);
      applyProjectUpdate(db, user, p, input);
      save(db);
      return p;
    },
    async setProjectStatus(id, status) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      applyProjectUpdate(db, user, findProject(db, id), { status });
      save(db);
    },
    async archiveProject(id) {
      await this.setProjectStatus(id, "archivada");
    },
    async restoreProject(id) {
      const db = load();
      const p = findProject(db, id);
      await this.setProjectStatus(id, (p.status_before_archive ?? "anteproyecto") as ProjectStatus);
    },
    async setProgressMode(id, mode, manual) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      applyProjectUpdate(db, user, findProject(db, id), { progress_mode: mode, manual_progress: manual });
      save(db);
    },
    async deleteProject(id) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const p = findProject(db, id);
      db.projects = db.projects.filter((x) => x.id !== id);
      db.members = db.members.filter((m) => m.project_id !== id);
      db.stages = db.stages.filter((s) => s.project_id !== id);
      db.notes = db.notes.filter((n) => n.project_id !== id);
      db.finances = db.finances.filter((f) => f.project_id !== id);
      db.payments = db.payments.filter((x) => x.project_id !== id);
      // Como en la base: el presupuesto queda, sin obra
      for (const x of db.budgets) if (x.project_id === id) x.project_id = null;
      db.activity.forEach((a) => {
        if (a.project_id === id) a.project_id = null;
      });
      log(db, user, { entity_type: "project", entity_id: id, project_id: null, action: "deleted", summary: `eliminó la obra ${label(p)}` });
      save(db);
    },

    async listMembers(projectId) {
      const db = load();
      const user = requireUser(db);
      if (!canAccessProject(db, user, projectId)) return [];
      return db.members.filter((m) => m.project_id === projectId).map((m) => m.user_id);
    },
    async setMembers(projectId, userIds) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      db.members = db.members.filter((m) => m.project_id !== projectId);
      userIds.forEach((user_id) => db.members.push({ project_id: projectId, user_id }));
      save(db);
    },

    // ---------------- Etapas ----------------
    async listStages(projectId) {
      const db = load();
      const user = requireUser(db);
      if (!canAccessProject(db, user, projectId)) return [];
      return db.stages.filter((s) => s.project_id === projectId).sort((a, b) => a.position - b.position);
    },
    async createStage(projectId, input) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const p = findProject(db, projectId);
      const siblings = db.stages.filter((s) => s.project_id === projectId);
      const s: Stage = {
        ...input,
        id: uid(),
        project_id: projectId,
        position: siblings.reduce((m, x) => Math.max(m, x.position), -1) + 1,
        created_at: now(),
        updated_at: now(),
      };
      db.stages.push(s);
      refreshProgress(db, projectId);
      log(db, user, { entity_type: "stage", entity_id: s.id, project_id: projectId, action: "created", summary: `agregó la etapa "${s.name}" en ${label(p)}` });
      save(db);
      return s;
    },
    async updateStage(id, input) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const s = db.stages.find((x) => x.id === id);
      if (!s) throw new RepoError("La etapa no existe.");
      const before = { ...s };
      Object.assign(s, input, { updated_at: now() });
      refreshProgress(db, s.project_id);
      const p = findProject(db, s.project_id);
      if (s.progress !== before.progress) {
        log(db, user, { entity_type: "stage", entity_id: s.id, project_id: p.id, action: "progress", summary: `actualizó la etapa "${s.name}" de ${label(p)} a ${s.progress}%` });
      } else if (s.name !== before.name || s.weight !== before.weight || s.start_date !== before.start_date || s.due_date !== before.due_date) {
        log(db, user, { entity_type: "stage", entity_id: s.id, project_id: p.id, action: "updated", summary: `modificó la etapa "${s.name}" de ${label(p)}` });
      }
      save(db);
    },
    async deleteStage(id) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const s = db.stages.find((x) => x.id === id);
      if (!s) throw new RepoError("La etapa no existe.");
      db.stages = db.stages.filter((x) => x.id !== id);
      refreshProgress(db, s.project_id);
      const p = findProject(db, s.project_id);
      log(db, user, { entity_type: "stage", entity_id: id, project_id: p.id, action: "deleted", summary: `eliminó la etapa "${s.name}" de ${label(p)}` });
      save(db);
    },
    async moveStage(id, direction) {
      const db = load();
      const user = requireUser(db);
      if (!isStaff(user)) deny();
      const s = db.stages.find((x) => x.id === id);
      if (!s) return;
      const siblings = db.stages.filter((x) => x.project_id === s.project_id).sort((a, b) => a.position - b.position);
      const other = siblings[siblings.indexOf(s) + direction];
      if (!other) return;
      [s.position, other.position] = [other.position, s.position];
      save(db);
    },

    // ---------------- Notas ----------------
    async listNotes() {
      const db = load();
      const user = requireUser(db);
      return db.notes
        .filter((n) => (n.project_id === null ? hasArq(user) : canAccessProject(db, user, n.project_id)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createNote(input) {
      const db = load();
      const user = requireUser(db);
      if (!hasArq(user) || (input.project_id && !canAccessProject(db, user, input.project_id))) deny();
      const n: Note = { ...input, id: uid(), resolved_at: null, resolved_by: null, author_id: user.id, created_at: now(), updated_at: now() };
      db.notes.push(n);
      log(db, user, { entity_type: "note", entity_id: n.id, project_id: n.project_id, action: "created", summary: `agregó la nota "${n.title}" ${notePlace(db, n)}` });
      save(db);
      return n;
    },
    async updateNote(id, input) {
      const db = load();
      const user = requireUser(db);
      const n = db.notes.find((x) => x.id === id);
      if (!n) throw new RepoError("La nota no existe.");
      if (n.author_id !== user.id && !isStaff(user)) deny();
      Object.assign(n, input, { updated_at: now() });
      log(db, user, { entity_type: "note", entity_id: n.id, project_id: n.project_id, action: "updated", summary: `editó la nota "${n.title}" ${notePlace(db, n)}` });
      save(db);
    },
    async setNoteResolved(id, resolved) {
      const db = load();
      const user = requireUser(db);
      const n = db.notes.find((x) => x.id === id);
      if (!n) throw new RepoError("La nota no existe.");
      if (n.author_id !== user.id && !isStaff(user)) deny();
      n.resolved_at = resolved ? now() : null;
      n.resolved_by = resolved ? user.id : null;
      n.updated_at = now();
      log(db, user, {
        entity_type: "note", entity_id: n.id, project_id: n.project_id, action: resolved ? "resolved" : "reopened",
        summary: `${resolved ? "resolvió" : "reabrió"} la nota "${n.title}" ${notePlace(db, n)}`,
      });
      save(db);
    },
    async deleteNote(id) {
      const db = load();
      const user = requireUser(db);
      const n = db.notes.find((x) => x.id === id);
      if (!n) throw new RepoError("La nota no existe.");
      if (n.author_id !== user.id && !isStaff(user)) deny();
      db.notes = db.notes.filter((x) => x.id !== id);
      log(db, user, { entity_type: "note", entity_id: id, project_id: n.project_id, action: "deleted", summary: `eliminó la nota "${n.title}" ${notePlace(db, n)}` });
      save(db);
    },

    // ---------------- Pagos (solo administradores) ----------------
    async listFinances() {
      const db = load();
      const user = requireUser(db);
      return isAdmin(user) ? db.finances : [];
    },
    async setFinance(projectId, input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      writeFinance(db, user, projectId, input);
      save(db);
    },
    async listPayments() {
      const db = load();
      const user = requireUser(db);
      return isAdmin(user) ? [...db.payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)) : [];
    },
    async createPayment(input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const { place, target } = paymentOwner(db, input, input.currency);
      const pay: Payment = {
        ...input, id: uid(), amount_contract: paymentInContract(input.amount, input.currency, input.exchange_rate, target),
        created_by: user.id, created_at: now(), updated_at: now(),
      };
      db.payments.push(pay);
      log(db, user, { entity_type: "payment", entity_id: pay.id, project_id: pay.project_id, action: "created", summary: `registró un pago de ${formatMoney(pay.amount, pay.currency)} en ${place}` });
      save(db);
    },
    async updatePayment(id, input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const pay = db.payments.find((x) => x.id === id);
      if (!pay) throw new RepoError("El pago no existe.");
      const { place, target } = paymentOwner(db, input, input.currency);
      Object.assign(pay, input, { amount_contract: paymentInContract(input.amount, input.currency, input.exchange_rate, target), updated_at: now() });
      log(db, user, { entity_type: "payment", entity_id: id, project_id: pay.project_id, action: "updated", summary: `modificó un pago de ${formatMoney(pay.amount, pay.currency)} en ${place}` });
      save(db);
    },
    async deletePayment(id) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const pay = db.payments.find((x) => x.id === id);
      if (!pay) throw new RepoError("El pago no existe.");
      const { place } = paymentOwner(db, pay, pay.currency);
      db.payments = db.payments.filter((x) => x.id !== id);
      log(db, user, { entity_type: "payment", entity_id: id, project_id: pay.project_id, action: "deleted", summary: `eliminó un pago de ${formatMoney(pay.amount, pay.currency)} en ${place}` });
      save(db);
    },

    // ---------------- Presupuestos en PDF (solo administradores) ----------------
    async listBudgets() {
      const db = load();
      const user = requireUser(db);
      return isAdmin(user) ? [...db.budgets].sort((a, b) => b.issued_on.localeCompare(a.issued_on)) : [];
    },
    async createBudget(input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      if (input.project_id) findProject(db, input.project_id);
      checkBudget(input);
      const b: Budget = { ...input, id: uid(), created_by: user.id, created_at: now(), updated_at: now() };
      db.budgets.push(b);
      acceptBudget(db, user, b);
      log(db, user, { entity_type: "payment", entity_id: b.id, project_id: b.project_id, action: "created", summary: `creó ${budgetLabel(b)} (${budgetPlace(db, b)})` });
      save(db);
      return b;
    },
    async updateBudget(id, input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const b = db.budgets.find((x) => x.id === id);
      if (!b) throw new RepoError("El presupuesto no existe.");
      const next = { ...b, ...input, updated_at: now() };
      if (next.project_id) findProject(db, next.project_id);
      checkBudget(next);
      const statusChanged = input.status !== undefined && input.status !== b.status;
      const before = { ...b };
      Object.assign(b, next);
      acceptBudget(db, user, b);
      moveBudgetPayments(db, before, b);
      if (statusChanged) {
        log(db, user, { entity_type: "payment", entity_id: id, project_id: b.project_id, action: "updated", summary: `cambió ${budgetLabel(b)} (${budgetPlace(db, b)}) a ${b.status.replace("_", " ")}` });
      }
      save(db);
    },
    async deleteBudget(id) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      const b = db.budgets.find((x) => x.id === id);
      if (!b) throw new RepoError("El presupuesto no existe.");
      db.budgets = db.budgets.filter((x) => x.id !== id);
      db.payments = db.payments.filter((x) => x.budget_id !== id);
      log(db, user, { entity_type: "payment", entity_id: id, project_id: b.project_id, action: "deleted", summary: `eliminó ${budgetLabel(b)} (${budgetPlace(db, b)})` });
      save(db);
    },
    async getBudgetSettings() {
      const db = load();
      const user = requireUser(db);
      return isAdmin(user) ? db.budgetSettings : null;
    },
    async saveBudgetSettings(input) {
      const db = load();
      const user = requireUser(db);
      if (!isAdmin(user)) deny();
      db.budgetSettings = { ...input, updated_at: now() };
      save(db);
    },

    // ---------------- Estudio de desarrollo ----------------
    async listDevProperties() {
      const db = load();
      const user = requireUser(db);
      return isDevMember(user) ? [...db.devProperties].sort((a, b) => a.name.localeCompare(b.name)) : [];
    },
    async createDevProperty(input) {
      const db = load();
      const user = requireDevAdmin(db);
      const p: DevProperty = { ...input, id: uid(), archived_at: null, created_by: user.id, created_at: now(), updated_at: now() };
      db.devProperties.push(p);
      save(db);
      return p;
    },
    async updateDevProperty(id, input) {
      const db = load();
      requireDevAdmin(db);
      const p = findDev(db.devProperties, id, "La propiedad no existe.");
      Object.assign(p, input, { updated_at: now() });
      save(db);
      return p;
    },
    async deleteDevProperty(id) {
      const db = load();
      requireDevAdmin(db);
      findDev(db.devProperties, id, "La propiedad no existe.");
      const leases = new Set(db.devLeases.filter((l) => l.property_id === id).map((l) => l.id));
      db.devPayments = db.devPayments.filter((x) => !leases.has(x.lease_id));
      db.devLeases = db.devLeases.filter((l) => l.property_id !== id);
      db.devProperties = db.devProperties.filter((p) => p.id !== id);
      save(db);
    },
    async listDevTenants() {
      const db = load();
      const user = requireUser(db);
      return isDevAdmin(user) ? [...db.devTenants].sort((a, b) => a.name.localeCompare(b.name)) : [];
    },
    async createDevTenant(input) {
      const db = load();
      const user = requireDevAdmin(db);
      const t: DevTenant = { ...input, id: uid(), created_by: user.id, created_at: now(), updated_at: now() };
      db.devTenants.push(t);
      save(db);
      return t;
    },
    async updateDevTenant(id, input) {
      const db = load();
      requireDevAdmin(db);
      const t = findDev(db.devTenants, id, "El inquilino no existe.");
      Object.assign(t, input, { updated_at: now() });
      save(db);
      return t;
    },
    async deleteDevTenant(id) {
      const db = load();
      requireDevAdmin(db);
      if (db.devLeases.some((l) => l.tenant_id === id)) {
        throw new RepoError("No se puede eliminar: hay registros vinculados (por ejemplo, contratos de este inquilino).");
      }
      db.devTenants = db.devTenants.filter((t) => t.id !== id);
      save(db);
    },
    async listDevLeases() {
      const db = load();
      const user = requireUser(db);
      return isDevAdmin(user) ? [...db.devLeases].sort((a, b) => b.start_date.localeCompare(a.start_date)) : [];
    },
    async createDevLease(input) {
      const db = load();
      const user = requireDevAdmin(db);
      const l: DevLease = { ...input, id: uid(), created_by: user.id, created_at: now(), updated_at: now() };
      checkLease(db, l);
      db.devLeases.push(l);
      syncPropertyStatus(db, l.property_id);
      save(db);
    },
    async updateDevLease(id, input) {
      const db = load();
      requireDevAdmin(db);
      const l = findDev(db.devLeases, id, "El contrato no existe.");
      const next = { ...l, ...input, updated_at: now() };
      checkLease(db, next);
      Object.assign(l, next);
      syncPropertyStatus(db, l.property_id);
      save(db);
    },
    async deleteDevLease(id) {
      const db = load();
      requireDevAdmin(db);
      const l = findDev(db.devLeases, id, "El contrato no existe.");
      db.devPayments = db.devPayments.filter((x) => x.lease_id !== id);
      db.devLeases = db.devLeases.filter((x) => x.id !== id);
      syncPropertyStatus(db, l.property_id);
      save(db);
    },
    async listDevPayments() {
      const db = load();
      const user = requireUser(db);
      return isDevAdmin(user) ? [...db.devPayments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)) : [];
    },
    async createDevPayment(input) {
      const db = load();
      const user = requireDevAdmin(db);
      findDev(db.devLeases, input.lease_id, "El contrato no existe.");
      if (!(input.amount > 0)) throw new RepoError("Algún dato no cumple las validaciones.");
      if (!input.period.endsWith("-01")) throw new RepoError("Algún dato no cumple las validaciones.");
      db.devPayments.push({ ...input, id: uid(), created_by: user.id, created_at: now(), updated_at: now() });
      save(db);
    },
    async deleteDevPayment(id) {
      const db = load();
      requireDevAdmin(db);
      findDev(db.devPayments, id, "El cobro no existe.");
      db.devPayments = db.devPayments.filter((x) => x.id !== id);
      save(db);
    },

    // ---------------- Historial ----------------
    async listActivity({ projectId, limit = 30 }) {
      const db = load();
      const user = requireUser(db);
      return db.activity
        .filter((a) => (projectId ? a.project_id === projectId : true))
        .filter((a) => a.entity_type !== "payment" || isAdmin(user))
        .filter((a) => isStaff(user) || (a.project_id !== null && canAccessProject(db, user, a.project_id)))
        .slice(0, limit);
    },

    subscribe(onChange) {
      // Otras pestañas del mismo navegador
      const handler = (e: StorageEvent) => {
        if (e.key === DB_KEY) onChange("*");
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
