import type {
  Activity, Client, Finance, Note, NoteCategory, Payment, Profile, Project, ProjectStatus, ProjectType, Stage,
} from "../types";

// DATOS FICTICIOS para el modo demostración. Ninguna persona, cliente u obra es real.

export interface DemoDB {
  profiles: Profile[];
  clients: Client[];
  projects: Project[];
  members: { project_id: string; user_id: string }[];
  stages: Stage[];
  notes: Note[];
  activity: Activity[];
  finances: Finance[];
  payments: Payment[];
}

export const DEMO_USERS = {
  admin: "demo-admin",
  arquitecto: "demo-arquitecto",
  colaborador: "demo-colaborador",
} as const;

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const stamp = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
};

export const textDoc = (text: string) => ({
  type: "doc",
  content: text.split("\n").map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : [],
  })),
});

export function createDemoData(): DemoDB {
  const created = stamp(-60);

  const profiles: Profile[] = [
    { id: DEMO_USERS.admin, full_name: "Laura Méndez (demo)", email: "admin@demo.local", role: "admin", active: true, created_at: created },
    { id: DEMO_USERS.arquitecto, full_name: "Diego Suárez (demo)", email: "arquitecto@demo.local", role: "arquitecto", active: true, created_at: created },
    { id: DEMO_USERS.colaborador, full_name: "Sofía Pereira (demo)", email: "colaborador@demo.local", role: "colaborador", active: true, created_at: created },
  ];

  const client = (id: string, name: string, extra: Partial<Client> = {}): Client => ({
    id, kind: "persona", name, document: null, phone: null, email: null, address: null, notes: null,
    archived_at: null, created_by: DEMO_USERS.admin, created_at: created, updated_at: created, ...extra,
  });

  const clients: Client[] = [
    client("c1", "Familia Ejemplo Acosta", { document: "1.234.567-2", phone: "099 000 001", email: "acosta@ejemplo.uy", address: "Calle Ficticia 100, Paysandú", notes: "Prefieren reuniones los sábados de mañana." }),
    client("c2", "Constructora Demo S.A.", { kind: "empresa", document: "211234560019", phone: "4722 0000", email: "contacto@constructora-demo.uy", address: "Av. Imaginaria 2000, Paysandú" }),
    client("c3", "Martina Prueba Silva", { phone: "098 000 002", email: "martina@ejemplo.uy" }),
    client("c4", "Cooperativa Ficticia del Litoral", { kind: "empresa", phone: "4722 1111", notes: "Contacto principal: comisión directiva." }),
    client("c5", "Jorge Inventado Ruiz", { phone: "091 000 003" }),
  ];

  const P = (
    id: string, n: number, name: string, client_id: string | null, address: string, lat: number, lng: number,
    project_type: ProjectType, status: ProjectStatus, extra: Partial<Project> = {},
  ): Project => ({
    id, code: `OB-${new Date().getFullYear()}-${String(n).padStart(3, "0")}`, name, client_id, address,
    locality: "Paysandú", department: "Paysandú", padron: null, lat, lng, project_type, description: null,
    responsible_id: DEMO_USERS.arquitecto, start_date: day(-90), due_date: day(120), status,
    status_before_archive: null, progress_mode: "etapas", manual_progress: null, progress: 0,
    created_by: DEMO_USERS.admin, created_at: stamp(-60 + n), updated_at: stamp(-60 + n), ...extra,
  });

  const projects: Project[] = [
    P("p1", 1, "Vivienda Acosta", "c1", "Calle Ficticia 100", -32.3215, -58.079, "vivienda", "en_construccion", {
      description: "Vivienda de dos plantas con fachada de ladrillo visto y patio interior.", padron: "0001", due_date: day(45),
    }),
    P("p2", 2, "Edificio Mirador del Río", "c2", "Av. Imaginaria 2000", -32.3135, -58.0905, "edificio", "proyecto_ejecutivo", {
      description: "Edificio de 6 niveles con 18 unidades y planta baja comercial.", start_date: day(30), due_date: day(540),
    }),
    P("p3", 3, "Reforma Casa Silva", "c3", "Pasaje Ejemplo 45", -32.3262, -58.0712, "reforma", "en_construccion", {
      description: "Reforma integral de cocina y baños, nueva instalación sanitaria.", due_date: day(12),
    }),
    P("p4", 4, "Viviendas Cooperativa Litoral", "c4", "Camino Ficticio s/n", -32.3058, -58.0655, "vivienda", "tramites", {
      description: "Conjunto de 24 viviendas en régimen cooperativo.", start_date: day(60), due_date: day(720),
    }),
    P("p5", 5, "Local comercial Centro", "c5", "Calle Demostración 890", -32.3178, -58.0842, "comercial", "pausada", {
      description: "Adecuación de local para gastronomía. Pausada a la espera de habilitación.",
    }),
    P("p6", 6, "Ampliación Acosta (garaje)", "c1", "Calle Ficticia 100", -32.3219, -58.0795, "ampliacion", "finalizada", {
      start_date: day(-300), due_date: day(-120), progress_mode: "manual", manual_progress: 100, progress: 100,
    }),
    P("p7", 7, "Casa de campo Guichón", "c3", "Ruta ficticia km 3", -32.3528, -57.1995, "vivienda", "anteproyecto", {
      locality: "Guichón", start_date: null, due_date: null, description: "Anteproyecto de vivienda rural con galería.",
    }),
    P("p8", 8, "Oficinas Constructora Demo", "c2", "Av. Imaginaria 2100", -32.3301, -58.0868, "comercial", "planificada", {
      start_date: day(20), due_date: day(200),
    }),
  ];

  const S = (id: string, project_id: string, position: number, name: string, weight: number, progress: number,
    start: number | null = null, due: number | null = null): Stage => ({
    id, project_id, position, name, weight, progress,
    start_date: start === null ? null : day(start), due_date: due === null ? null : day(due),
    created_at: created, updated_at: created,
  });

  const stages: Stage[] = [
    S("s1", "p1", 0, "Cimentación", 15, 100, -90, -70),
    S("s2", "p1", 1, "Estructura y muros", 30, 100, -70, -30),
    S("s3", "p1", 2, "Cubierta", 15, 80, -30, 0),
    S("s4", "p1", 3, "Instalaciones", 20, 40, -10, 25),
    S("s5", "p1", 4, "Terminaciones", 20, 0, 20, 45),
    S("s6", "p3", 0, "Demolición", 10, 100, -40, -35),
    S("s7", "p3", 1, "Instalación sanitaria", 40, 90, -35, -5),
    S("s8", "p3", 2, "Revestimientos", 30, 50, -5, 8),
    S("s9", "p3", 3, "Equipamiento", 20, 0, 5, 12),
    S("s10", "p2", 0, "Planos de arquitectura", 40, 70, -30, 15),
    S("s11", "p2", 1, "Estructura (coordinación)", 30, 30, -10, 30),
    S("s12", "p2", 2, "Memorias y pliegos", 30, 10, 0, 40),
  ];

  for (const p of projects) {
    if (p.progress_mode === "manual") continue;
    const own = stages.filter((s) => s.project_id === p.id);
    const total = own.reduce((a, s) => a + s.weight, 0);
    p.progress = total ? Math.round(own.reduce((a, s) => a + s.weight * s.progress, 0) / total) : 0;
  }

  const N = (id: string, project_id: string | null, title: string, text: string, category: NoteCategory,
    author: string, ageDays: number, resolved = false): Note => ({
    id, project_id, title, content: textDoc(text), content_text: text, category,
    resolved_at: resolved ? stamp(-ageDays + 1) : null, resolved_by: resolved ? author : null,
    author_id: author, created_at: stamp(-ageDays), updated_at: stamp(-ageDays),
  });

  const notes: Note[] = [
    N("n1", "p1", "Ventana del dormitorio", "Cambiar la ubicación de la ventana del dormitorio principal hacia el patio.", "pendiente", DEMO_USERS.arquitecto, 3),
    N("n2", "p1", "Revestimiento exterior", "Consultar con el cliente sobre el revestimiento exterior: ladrillo visto o revoque.", "importante", DEMO_USERS.admin, 2),
    N("n3", "p3", "Medidas del baño", "Revisar las medidas del baño de servicio antes de pedir los sanitarios.", "observacion", DEMO_USERS.colaborador, 5),
    N("n4", "p2", "Entrada más moderna", "Evaluar una entrada más moderna con doble altura y celosías de madera.", "idea", DEMO_USERS.arquitecto, 7),
    N("n5", "p1", "Pedido de aberturas", "Confirmar el pedido de aberturas de aluminio.", "pendiente", DEMO_USERS.arquitecto, 12, true),
    N("n6", null, "Plantilla de memorias", "Armar una plantilla única de memoria descriptiva para todas las obras.", "idea", DEMO_USERS.admin, 4),
    N("n7", null, "Muestrario de materiales", "Organizar un muestrario físico de revestimientos en la sala de reuniones.", "idea", DEMO_USERS.colaborador, 9),
  ];

  const A = (id: number, actor: Profile, project_id: string | null, entity_type: string, summary: string, ageHours: number): Activity => ({
    id, actor_id: actor.id, actor_name: actor.full_name, entity_type, entity_id: project_id, project_id,
    action: "created", summary, created_at: new Date(Date.now() - ageHours * 3600_000).toISOString(),
  });
  const [admin, arq, colab] = profiles;
  const activity: Activity[] = [
    A(6, arq, "p1", "stage", `actualizó la etapa "Cubierta" de ${projects[0].code} · Vivienda Acosta a 80%`, 5),
    A(5, admin, "p1", "note", `agregó la nota "Revestimiento exterior" en ${projects[0].code} · Vivienda Acosta`, 30),
    A(4, colab, "p3", "note", `agregó la nota "Medidas del baño" en ${projects[2].code} · Reforma Casa Silva`, 50),
    A(3, admin, "p5", "project", `cambió el estado de ${projects[4].code} · Local comercial Centro: En construcción → Pausada`, 80),
    A(2, admin, "p8", "project", `creó la obra ${projects[7].code} · Oficinas Constructora Demo`, 120),
    A(1, admin, null, "client", "registró el cliente Jorge Inventado Ruiz", 140),
  ];

  return {
    profiles,
    clients,
    projects,
    // La colaboradora solo tiene acceso a dos obras
    members: [
      { project_id: "p1", user_id: DEMO_USERS.colaborador },
      { project_id: "p3", user_id: DEMO_USERS.colaborador },
    ],
    stages,
    notes,
    activity,
    finances: [
      { project_id: "p1", agreed_amount: 48000, currency: "USD", notes: "Honorarios de proyecto y dirección de obra.", updated_at: created },
      { project_id: "p3", agreed_amount: 380000, currency: "UYU", notes: null, updated_at: created },
      { project_id: "p6", agreed_amount: 9000, currency: "USD", notes: null, updated_at: created },
    ],
    payments: [
      Pay("pay1", "p1", -85, 12000, "USD", null, 12000, "Adelanto inicial", "transferencia", "0001"),
      Pay("pay2", "p1", -40, 10000, "USD", null, 10000, "Certificado de avance 1", "transferencia", "0002"),
      Pay("pay3", "p1", -10, 200000, "UYU", 40, 5000, "Certificado de avance 2 (en pesos)", "deposito", "0003"),
      Pay("pay4", "p3", -30, 150000, "UYU", null, 150000, "Seña", "efectivo", null),
      Pay("pay5", "p6", -150, 9000, "USD", null, 9000, "Pago total", "transferencia", "0004"),
    ],
  };
}

function Pay(id: string, project_id: string, ageDays: number, amount: number, currency: "UYU" | "USD",
  exchange_rate: number | null, amount_contract: number, concept: string, method: Payment["method"], receipt: string | null): Payment {
  const d = new Date();
  d.setDate(d.getDate() + ageDays);
  return {
    id, project_id, paid_on: d.toISOString().slice(0, 10), amount, currency, exchange_rate, amount_contract,
    concept, method, receipt, notes: null, created_by: DEMO_USERS.admin, created_at: d.toISOString(), updated_at: d.toISOString(),
  };
}
