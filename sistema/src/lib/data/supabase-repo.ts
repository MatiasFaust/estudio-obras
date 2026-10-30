import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "../supabase/client";
import type {
  Activity, Budget, BudgetSettings, Client, DevLease, DevProperty, DevRentPayment, DevTenant, Finance, Note, Payment, Profile, Project, Stage,
} from "../types";
import { RepoError, type Repo } from "./repo";

/** Traduce errores de PostgreSQL / RLS a mensajes comprensibles */
function fail(error: PostgrestError | { message: string; code?: string }): never {
  const code = "code" in error ? error.code : undefined;
  if (code === "42501" || /row-level security/i.test(error.message)) {
    throw new RepoError("No tenés permiso para realizar esta acción.");
  }
  if (code === "23503") {
    throw new RepoError("No se puede eliminar: hay registros vinculados (por ejemplo, obras de este cliente).");
  }
  if (code === "23505") throw new RepoError("Ya existe un registro con esos datos.");
  if (code === "23514") throw new RepoError("Algún dato no cumple las validaciones.");
  if (code === "P0001") throw new RepoError(error.message);
  if (code === "PGRST116") throw new RepoError("El registro no existe o no tenés acceso.");
  throw new RepoError(error.message);
}

async function run<T>(promise: PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await promise;
  if (error) fail(error);
  return data;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

function budgetFromDb(b: Budget): Budget {
  return {
    ...b,
    responsible: b.responsible ?? "",
    price: num(b.price),
    expenses_amount: num(b.expenses_amount),
    wages_days: num(b.wages_days),
    wages_amount: num(b.wages_amount),
    payment_terms: (b.payment_terms ?? []).map((t) => ({ ...t, percent: Number(t.percent) })),
  };
}

export function createSupabaseRepo(): Repo {
  const sb = getSupabase();

  return {
    mode: "supabase",

    async getCurrentProfile() {
      const { data } = await sb.auth.getUser();
      if (!data.user) return null;
      const profile = await run(sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle());
      return (profile as Profile | null) ?? null;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new RepoError("Correo o contraseña incorrectos.");
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw new RepoError("No se pudo enviar el correo. Intentá de nuevo en unos minutos.");
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new RepoError(error.message);
    },
    onAuthChange(cb) {
      // Al volver a la pestaña (o al restaurar la ventana), Supabase repite "SIGNED_IN" con la
      // misma sesión. Solo se avisa si entró otra persona: si no, se borraban los datos en
      // memoria y se perdía lo que se estaba escribiendo en un formulario.
      let userId: string | undefined;
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        const changed = session?.user.id !== userId;
        userId = session?.user.id;
        if (event === "SIGNED_IN" ? changed : ["SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) cb();
      });
      return () => data.subscription.unsubscribe();
    },

    listProfiles: async () =>
      (await run(sb.from("profiles").select("*").order("full_name"))) as Profile[],

    listClients: async () =>
      (await run(sb.from("clients").select("*").order("name"))) as Client[],
    createClient: async (input) =>
      (await run(sb.from("clients").insert(input).select().single())) as Client,
    updateClient: async (id, input) =>
      (await run(sb.from("clients").update(input).eq("id", id).select().single())) as Client,
    async setClientArchived(id, archived) {
      await run(sb.from("clients").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).select().single());
    },
    async deleteClient(id) {
      await run(sb.from("clients").delete().eq("id", id).select().single());
    },

    listProjects: async () =>
      (await run(sb.from("projects").select("*").order("created_at", { ascending: false }))) as Project[],
    async createProject(input, memberIds) {
      const project = (await run(sb.from("projects").insert(input).select().single())) as Project;
      if (memberIds.length) {
        await run(sb.from("project_members").insert(memberIds.map((user_id) => ({ project_id: project.id, user_id }))));
      }
      return project;
    },
    updateProject: async (id, input) =>
      (await run(sb.from("projects").update(input).eq("id", id).select().single())) as Project,
    async setProjectStatus(id, status) {
      await run(sb.from("projects").update({ status }).eq("id", id).select().single());
    },
    async archiveProject(id) {
      await run(sb.from("projects").update({ status: "archivada" }).eq("id", id).select().single());
    },
    async restoreProject(id) {
      const p = (await run(sb.from("projects").select("status_before_archive").eq("id", id).single())) as Pick<Project, "status_before_archive">;
      await run(sb.from("projects").update({ status: p.status_before_archive ?? "anteproyecto" }).eq("id", id).select().single());
    },
    async setProgressMode(id, mode, manual) {
      await run(sb.from("projects").update({ progress_mode: mode, manual_progress: manual }).eq("id", id).select().single());
    },
    async deleteProject(id) {
      await run(sb.from("projects").delete().eq("id", id).select().single());
    },

    async listMembers(projectId) {
      const rows = (await run(sb.from("project_members").select("user_id").eq("project_id", projectId))) as { user_id: string }[];
      return rows.map((r) => r.user_id);
    },
    async setMembers(projectId, userIds) {
      const current = await this.listMembers(projectId);
      const toAdd = userIds.filter((u) => !current.includes(u));
      const toRemove = current.filter((u) => !userIds.includes(u));
      if (toRemove.length) {
        await run(sb.from("project_members").delete().eq("project_id", projectId).in("user_id", toRemove));
      }
      if (toAdd.length) {
        await run(sb.from("project_members").insert(toAdd.map((user_id) => ({ project_id: projectId, user_id }))));
      }
    },

    listStages: async (projectId) =>
      (await run(sb.from("project_stages").select("*").eq("project_id", projectId).order("position"))) as Stage[],
    async createStage(projectId, input) {
      const last = (await run(
        sb.from("project_stages").select("position").eq("project_id", projectId).order("position", { ascending: false }).limit(1),
      )) as { position: number }[];
      const position = (last[0]?.position ?? -1) + 1;
      return (await run(sb.from("project_stages").insert({ ...input, project_id: projectId, position }).select().single())) as Stage;
    },
    async updateStage(id, input) {
      await run(sb.from("project_stages").update(input).eq("id", id).select().single());
    },
    async deleteStage(id) {
      await run(sb.from("project_stages").delete().eq("id", id).select().single());
    },
    async moveStage(id, direction) {
      const stage = (await run(sb.from("project_stages").select("*").eq("id", id).single())) as Stage;
      const siblings = await this.listStages(stage.project_id);
      const index = siblings.findIndex((s) => s.id === id);
      const other = siblings[index + direction];
      if (!other) return;
      await run(sb.from("project_stages").update({ position: other.position }).eq("id", stage.id));
      await run(sb.from("project_stages").update({ position: stage.position }).eq("id", other.id));
    },

    listNotes: async () =>
      (await run(sb.from("notes").select("*").order("created_at", { ascending: false }))) as Note[],
    async createNote(input) {
      const { data } = await sb.auth.getUser();
      return (await run(sb.from("notes").insert({ ...input, author_id: data.user?.id }).select().single())) as Note;
    },
    async updateNote(id, input) {
      await run(sb.from("notes").update(input).eq("id", id).select().single());
    },
    async setNoteResolved(id, resolved) {
      const { data } = await sb.auth.getUser();
      await run(
        sb.from("notes")
          .update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: data.user?.id } : { resolved_at: null, resolved_by: null })
          .eq("id", id).select().single(),
      );
    },
    async deleteNote(id) {
      await run(sb.from("notes").delete().eq("id", id).select().single());
    },

    listFinances: async () =>
      ((await run(sb.from("project_finances").select("*"))) as Finance[]).map((f) => ({
        ...f,
        agreed_amount: f.agreed_amount === null ? null : Number(f.agreed_amount),
      })),
    async setFinance(projectId, input) {
      await run(sb.from("project_finances").upsert({ project_id: projectId, ...input }).select().single());
    },
    listPayments: async () =>
      ((await run(sb.from("payments").select("*").order("paid_on", { ascending: false }))) as Payment[]).map((p) => ({
        ...p,
        amount: Number(p.amount),
        amount_contract: Number(p.amount_contract),
        exchange_rate: p.exchange_rate === null ? null : Number(p.exchange_rate),
      })),
    async createPayment(input) {
      await run(sb.from("payments").insert(input).select().single());
    },
    async updatePayment(id, input) {
      await run(sb.from("payments").update(input).eq("id", id).select().single());
    },
    async deletePayment(id) {
      await run(sb.from("payments").delete().eq("id", id).select().single());
    },

    // Presupuestos (los numeric de PostgreSQL llegan como texto)
    listBudgets: async () =>
      ((await run(sb.from("budgets").select("*").order("issued_on", { ascending: false }))) as Budget[]).map(budgetFromDb),
    async createBudget(input) {
      return budgetFromDb((await run(sb.from("budgets").insert(input).select().single())) as Budget);
    },
    async updateBudget(id, input) {
      await run(sb.from("budgets").update(input).eq("id", id).select().single());
    },
    async deleteBudget(id) {
      await run(sb.from("budgets").delete().eq("id", id).select().single());
    },
    async getBudgetSettings() {
      const t = (await run(sb.from("budget_settings").select("*").maybeSingle())) as BudgetSettings | null;
      if (!t) return null;
      // Antes de la migración de la calculadora estas columnas no existen
      return {
        ...t,
        logo: t.logo ?? null,
        calc_types: t.calc_types ?? [],
        wage_value: num(t.wage_value ?? null),
        expenses_fixed: num(t.expenses_fixed ?? null),
        expenses_per_m2: num(t.expenses_per_m2 ?? null),
        iva_rate: t.iva_rate === undefined || t.iva_rate === null ? 22 : Number(t.iva_rate),
      };
    },
    async saveBudgetSettings(input) {
      await run(sb.from("budget_settings").update(input).eq("id", true).select().single());
    },

    // Estudio de desarrollo (los numeric de PostgreSQL llegan como texto)
    listDevProperties: async () =>
      ((await run(sb.from("dev_properties").select("*").order("name"))) as DevProperty[]).map((p) => ({
        ...p,
        area_m2: p.area_m2 === null ? null : Number(p.area_m2),
      })),
    async createDevProperty(input) {
      return (await run(sb.from("dev_properties").insert(input).select().single())) as DevProperty;
    },
    async updateDevProperty(id, input) {
      return (await run(sb.from("dev_properties").update(input).eq("id", id).select().single())) as DevProperty;
    },
    async deleteDevProperty(id) {
      await run(sb.from("dev_properties").delete().eq("id", id).select().single());
    },
    listDevTenants: async () => (await run(sb.from("dev_tenants").select("*").order("name"))) as DevTenant[],
    async createDevTenant(input) {
      return (await run(sb.from("dev_tenants").insert(input).select().single())) as DevTenant;
    },
    async updateDevTenant(id, input) {
      return (await run(sb.from("dev_tenants").update(input).eq("id", id).select().single())) as DevTenant;
    },
    async deleteDevTenant(id) {
      await run(sb.from("dev_tenants").delete().eq("id", id).select().single());
    },
    listDevLeases: async () =>
      ((await run(sb.from("dev_leases").select("*").order("start_date", { ascending: false }))) as DevLease[]).map((l) => ({
        ...l,
        rent_amount: Number(l.rent_amount),
        deposit: l.deposit === null ? null : Number(l.deposit),
      })),
    async createDevLease(input) {
      await run(sb.from("dev_leases").insert(input).select().single());
    },
    async updateDevLease(id, input) {
      await run(sb.from("dev_leases").update(input).eq("id", id).select().single());
    },
    async deleteDevLease(id) {
      await run(sb.from("dev_leases").delete().eq("id", id).select().single());
    },
    listDevPayments: async () =>
      ((await run(sb.from("dev_rent_payments").select("*").order("paid_on", { ascending: false }))) as DevRentPayment[]).map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    async createDevPayment(input) {
      await run(sb.from("dev_rent_payments").insert(input).select().single());
    },
    async deleteDevPayment(id) {
      await run(sb.from("dev_rent_payments").delete().eq("id", id).select().single());
    },

    async listActivity({ projectId, limit = 30 }) {
      let q = sb.from("activity_log").select("*, actor:profiles(full_name)").order("created_at", { ascending: false }).limit(limit);
      if (projectId) q = q.eq("project_id", projectId);
      const rows = (await run(q)) as (Omit<Activity, "actor_name"> & { actor: { full_name: string } | null })[];
      return rows.map(({ actor, ...r }) => ({ ...r, actor_name: actor?.full_name ?? null }));
    },

    subscribe(onChange) {
      const tables = ["clients", "projects", "project_members", "project_stages", "notes", "activity_log", "project_finances", "payments",
        "dev_properties", "dev_tenants", "dev_leases", "dev_rent_payments", "budgets", "budget_settings"];
      let channel = sb.channel("cambios-estudio");
      for (const table of tables) {
        channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => onChange(table));
      }
      channel.subscribe();
      return () => {
        sb.removeChannel(channel);
      };
    },
  };
}
