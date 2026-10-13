import type {
  Activity, Client, ClientInput, Finance, FinanceInput, Note, NoteInput, Payment, PaymentInput, Profile,
  Project, ProjectInput, Stage, StageInput,
} from "../types";

export interface ActivityQuery {
  projectId?: string;
  limit?: number;
}

/**
 * Acceso a datos del sistema. Hay dos implementaciones con el mismo contrato:
 * - SupabaseRepo: base de datos real (producción).
 * - DemoRepo: datos ficticios guardados en el navegador, para probar sin credenciales.
 */
export interface Repo {
  readonly mode: "supabase" | "demo";

  // Sesión
  getCurrentProfile(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  onAuthChange(cb: () => void): () => void;

  // Integrantes
  listProfiles(): Promise<Profile[]>;

  // Clientes
  listClients(): Promise<Client[]>;
  createClient(input: ClientInput): Promise<Client>;
  updateClient(id: string, input: Partial<ClientInput>): Promise<Client>;
  setClientArchived(id: string, archived: boolean): Promise<void>;
  deleteClient(id: string): Promise<void>;

  // Obras
  listProjects(): Promise<Project[]>;
  createProject(input: ProjectInput, memberIds: string[]): Promise<Project>;
  updateProject(id: string, input: Partial<ProjectInput>): Promise<Project>;
  setProjectStatus(id: string, status: Project["status"]): Promise<void>;
  archiveProject(id: string): Promise<void>;
  restoreProject(id: string): Promise<void>;
  setProgressMode(id: string, mode: Project["progress_mode"], manual: number | null): Promise<void>;
  deleteProject(id: string): Promise<void>;

  listMembers(projectId: string): Promise<string[]>;
  setMembers(projectId: string, userIds: string[]): Promise<void>;

  // Etapas
  listStages(projectId: string): Promise<Stage[]>;
  createStage(projectId: string, input: StageInput): Promise<Stage>;
  updateStage(id: string, input: Partial<StageInput>): Promise<void>;
  deleteStage(id: string): Promise<void>;
  moveStage(id: string, direction: -1 | 1): Promise<void>;

  // Notas
  listNotes(): Promise<Note[]>;
  createNote(input: NoteInput): Promise<Note>;
  updateNote(id: string, input: Partial<NoteInput>): Promise<void>;
  setNoteResolved(id: string, resolved: boolean): Promise<void>;
  deleteNote(id: string): Promise<void>;

  // Pagos (solo administradores)
  listFinances(): Promise<Finance[]>;
  setFinance(projectId: string, input: FinanceInput): Promise<void>;
  listPayments(): Promise<Payment[]>;
  createPayment(input: PaymentInput): Promise<void>;
  updatePayment(id: string, input: PaymentInput): Promise<void>;
  deletePayment(id: string): Promise<void>;

  // Historial
  listActivity(query: ActivityQuery): Promise<Activity[]>;

  /** Notifica cambios hechos por otros integrantes (tiempo real) */
  subscribe(onChange: (table: string) => void): () => void;
}

/** Error con mensaje listo para mostrar */
export class RepoError extends Error {}
