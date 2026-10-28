import type {
  Activity, Budget, BudgetSettings, Client, DevLease, DevProperty, DevRentPayment, DevTenant, Finance, Note, NoteCategory, Payment, Profile, Project, ProjectStatus, ProjectType, Stage,
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
  devProperties: DevProperty[];
  devTenants: DevTenant[];
  devLeases: DevLease[];
  devPayments: DevRentPayment[];
  budgets: Budget[];
  budgetSettings: BudgetSettings;
}

export const DEMO_USERS = {
  admin: "demo-admin",
  arquitecto: "demo-arquitecto",
  colaborador: "demo-colaborador",
  desarrollo: "demo-desarrollo",
} as const;

/** Usuarios ficticios y su acceso a cada área */
export const DEMO_PROFILES: Omit<Profile, "created_at">[] = [
  { id: DEMO_USERS.admin, full_name: "Laura Méndez (demo)", email: "admin@demo.local", role: "admin", active: true, arquitectura: true, desarrollo: "admin" },
  { id: DEMO_USERS.arquitecto, full_name: "Diego Suárez (demo)", email: "arquitecto@demo.local", role: "arquitecto", active: true, arquitectura: true, desarrollo: null },
  { id: DEMO_USERS.colaborador, full_name: "Sofía Pereira (demo)", email: "colaborador@demo.local", role: "colaborador", active: true, arquitectura: true, desarrollo: null },
  { id: DEMO_USERS.desarrollo, full_name: "Martín Ferreira (demo)", email: "desarrollo@demo.local", role: "colaborador", active: true, arquitectura: false, desarrollo: "colaborador" },
];

/** Primer día de cada mes desde `from` (AAAA-MM-DD) hasta el mes actual + `extra` */
export function monthsSince(from: string, extra = 0): string[] {
  const [y, m] = from.split("-").map(Number);
  const out: string[] = [];
  const d = new Date(y, m - 1, 1);
  const end = new Date();
  end.setMonth(end.getMonth() + extra, 1);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Datos ficticios del estudio de desarrollo */
export function createDevDemoData(): Pick<DemoDB, "devProperties" | "devTenants" | "devLeases" | "devPayments"> {
  const created = stamp(-90);
  const prop = (
    id: string, name: string, kind: DevProperty["kind"], status: DevProperty["status"], address: string,
    lat: number, lng: number, extra: Partial<DevProperty> = {},
  ): DevProperty => ({
    id, name, kind, status, address, locality: "Paysandú", department: "Paysandú", padron: null, lat, lng,
    bedrooms: kind === "terreno" ? null : 2, area_m2: null, notes: null, archived_at: null,
    created_by: DEMO_USERS.admin, created_at: created, updated_at: created, ...extra,
  });
  const devProperties: DevProperty[] = [
    prop("d1", "Casa Los Álamos (demo)", "casa", "alquilada", "Calle Ficticia 210", -32.326, -58.085, { padron: "9001", area_m2: 85 }),
    prop("d2", "Casa Jacarandá (demo)", "casa", "alquilada", "Pasaje Ejemplo 88", -32.3105, -58.072, { bedrooms: 3 }),
    prop("d3", "Casa del Parque (demo)", "casa", "desocupada", "Av. Imaginaria 1450", -32.319, -58.095, { notes: "Pintar el dormitorio antes de volver a alquilar." }),
    prop("d4", "Dúplex Norte A (demo)", "casa", "en_construccion", "Calle Inventada 32", -32.305, -58.066),
    prop("d5", "Terreno Ruta 3 (demo)", "terreno", "terreno_baldio", "Ruta 3 km 365", -32.335, -58.06, { area_m2: 600, padron: "9002" }),
    prop("d6", "Cabaña Termas 1 (demo)", "casa", "alquiler_por_dia", "Camino de prueba s/n", -31.8368, -57.8915, { locality: "Termas de Guaviyú", bedrooms: 1 }),
    prop("d7", "Casa Ombú (demo)", "casa", "alquilada", "Calle Demostración 640", -32.322, -58.07),
  ];

  const tenant = (id: string, name: string, phone: string, extra: Partial<DevTenant> = {}): DevTenant => ({
    id, name, document: null, phone, email: null, notes: null, created_by: DEMO_USERS.admin, created_at: created, updated_at: created, ...extra,
  });
  const devTenants: DevTenant[] = [
    tenant("t1", "Inquilino Ejemplo Gómez", "099 100 001", { email: "gomez@ejemplo.uy" }),
    tenant("t2", "Familia Prueba Rodríguez", "099 100 002"),
    tenant("t3", "Carla Inventada Díaz", "099 100 003", { notes: "Prefiere que la llamen después de las 18 h." }),
    tenant("t4", "Pedro Antiguo Inquilino", "099 100 004"),
  ];

  const lease = (
    id: string, property_id: string, tenant_id: string, start: number, end: number | null, rent: number,
    currency: DevLease["currency"], due_day: number, extra: Partial<DevLease> = {},
  ): DevLease => ({
    id, property_id, tenant_id, start_date: day(start), end_date: end === null ? null : day(end), terminated_on: null,
    rent_amount: rent, currency, due_day, deposit: null, notes: null,
    created_by: DEMO_USERS.admin, created_at: stamp(start), updated_at: stamp(start), ...extra,
  });
  const devLeases: DevLease[] = [
    lease("l1", "d1", "t1", -400, 330, 22000, "UYU", 10, { deposit: 44000 }),
    lease("l2", "d2", "t2", -200, 530, 600, "USD", 5),
    // Vence el día 1: el mes actual siempre figura como adeudado (la prueba e2e cuenta con eso)
    lease("l3", "d7", "t3", -120, 45, 18000, "UYU", 1),
    lease("l4", "d3", "t4", -700, -45, 15000, "UYU", 10, { notes: "Entregó la casa en buen estado." }),
  ];

  // Cobros: l1 al día, l2 debe el mes actual, l3 debe los dos últimos meses, l4 pagó todo
  const paidUntil: Record<string, number> = { l1: 0, l2: -1, l3: -2 };
  const devPayments: DevRentPayment[] = [];
  for (const l of devLeases) {
    const periods = l.id === "l4" ? monthsSince(l.start_date).filter((p) => p <= l.end_date!) : monthsSince(l.start_date, paidUntil[l.id]);
    periods.forEach((period, i) => {
      const paid = new Date(`${period}T12:00:00`);
      paid.setDate(l.due_day - 1);
      devPayments.push({
        id: `${l.id}-pay${i + 1}`, lease_id: l.id, period, paid_on: paid.toISOString().slice(0, 10), amount: l.rent_amount,
        method: i % 3 === 0 ? "efectivo" : "transferencia", receipt: null, notes: null,
        created_by: DEMO_USERS.admin, created_at: paid.toISOString(), updated_at: paid.toISOString(),
      });
    });
  }
  return { devProperties, devTenants, devLeases, devPayments };
}

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
    ...DEMO_PROFILES.map((p) => ({ ...p, created_at: created })),
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
    ...createDevDemoData(),
    ...createBudgetDemoData(),
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

/** Plantilla y presupuesto de ejemplo (datos ficticios: ni direcciones, ni teléfonos, ni firmas reales) */
export function createBudgetDemoData(): Pick<DemoDB, "budgets" | "budgetSettings"> {
  const payment_terms = [
    { label: "al comenzar los trabajos", percent: 35 },
    { label: "contra la presentación en BPS, Catastro e IdeP", percent: 35 },
    { label: "contra la aprobación de la IdeP", percent: 20 },
    { label: "contra la habilitación final", percent: 10 },
  ];
  const includes = [
    "3 imágenes (1 exterior y 2 interiores)",
    "Realización de planos de albañilería, sanitaria, eléctrica, estructura y planilla de aberturas",
    "Presentación de carpetas y trámites ante BPS, Catastro e Intendencia",
  ];
  const budgetSettings: BudgetSettings = {
    studio_name: "Estudio Demo",
    tagline: "Arquitectura | Interiorismo | Paisajismo",
    address: "Calle Ficticia 123, Paysandú",
    greeting: "De mi mayor consideración:",
    intro: "De acuerdo a vuestra amable solicitud tengo el agrado de presupuestar los trabajos de {trabajo}, área aproximada {area} m², padrón {padron}.",
    closing: "Saluda a Ud muy atte:",
    payment_terms,
    includes,
    excludes: "No se incluye Dirección de Obra.",
    expenses_text: "copia de planos, timbres, derechos de construcción, libro de trabajo, tributos",
    note: "",
    signers: [
      { name: "LAURA MÉNDEZ (DEMO)", title: "Arquitecta", image: null },
      { name: "DIEGO SUÁREZ (DEMO)", title: "Arquitecto", image: null },
    ],
    footer: {
      lines: ["@estudio.demo", "099 000 000", "estudio@demo.local"],
      partners: [{ name: "Paisajismo Demo", lines: ["@paisajismo.demo", "paisajismo@demo.local"], logo: null }],
    },
    calc_types: [
      { name: "Obra nueva", fee_per_m2: 1500, wages_per_m2: 6, build_cost_per_m2: 45000 },
      { name: "Reforma", fee_per_m2: 1200, wages_per_m2: 1.5, build_cost_per_m2: 25000 },
      { name: "Regularización", fee_per_m2: 600, wages_per_m2: null, build_cost_per_m2: null },
    ],
    wage_value: 2200,
    expenses_fixed: 15000,
    expenses_per_m2: 150,
    iva_rate: 22,
    updated_at: stamp(-30),
  };
  const budgets: Budget[] = [{
    id: "b1", kind: "membretado", project_id: "p1", client_name: "Familia Ejemplo Acosta", padron: "0001",
    address: "Calle Ficticia 100", service: "Proyecto de vivienda", number: "2094", issued_on: day(-20), recipient: "Familia Ejemplo Acosta",
    intro: "De acuerdo a vuestra amable solicitud tengo el agrado de presupuestar los trabajos de presentación de proyecto de vivienda, área aproximada 120 m², padrón 9001.",
    price: 48000, currency: "USD", iva_mode: "mas_iva", payment_terms, includes,
    excludes: "No se incluye Dirección de Obra.", expenses_text: budgetSettings.expenses_text, expenses_amount: 1200,
    wages_days: 129, wages_amount: 6800, note: "", status: "aceptado",
    created_by: DEMO_USERS.admin, created_at: stamp(-20), updated_at: stamp(-20),
  }];
  return { budgets, budgetSettings };
}
