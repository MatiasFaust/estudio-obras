// Capa de datos: usa Supabase si está configurado; si no, guarda en localStorage.
// Todas las funciones devuelven promesas para que app.js no dependa del modo.
(function () {
  const cfg = window.APP_CONFIG || {};
  const useSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);
  const sb = useSupabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  function check({ data, error }) {
    if (error) throw new Error(error.message);
    return data;
  }

  // ---------- Supabase ----------
  const remote = {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session ? data.session.user : null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error('Correo o contraseña incorrectos.');
      return data.user;
    },
    async signOut() {
      await sb.auth.signOut();
    },

    async listObras() {
      return check(await sb.from('obras').select('*').order('created_at', { ascending: false }));
    },
    async createObra(obra) {
      return check(await sb.from('obras').insert(obra).select().single());
    },
    async updateObra(id, obra) {
      return check(await sb.from('obras').update(obra).eq('id', id).select().single());
    },
    async deleteObra(id) {
      check(await sb.from('obras').delete().eq('id', id));
    },

    async listNotas() {
      return check(await sb.from('notas').select('*').order('created_at', { ascending: false }));
    },
    async createNota(obraId, texto, autor) {
      return check(await sb.from('notas').insert({ obra_id: obraId, texto, autor }).select().single());
    },
    async deleteNota(id) {
      check(await sb.from('notas').delete().eq('id', id));
    },

    // Avisa cuando otro integrante del estudio cambia algo
    subscribe(onChange) {
      sb.channel('cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'obras' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notas' }, onChange)
        .subscribe();
    },
  };

  // ---------- localStorage ----------
  const KEY = 'estudio-obras-v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* datos dañados o almacenamiento bloqueado */ }
    // Primera vez en este navegador: cargar las obras iniciales
    const now = Date.now();
    const obras = (window.OBRAS_INICIALES || []).map((o, i) => ({
      descripcion: null,
      ...o,
      id: uid(),
      created_at: new Date(now - i * 1000).toISOString(),
    }));
    const db = { obras, notas: [] };
    try { save(db); } catch (e) { /* almacenamiento bloqueado */ }
    return db;
  }
  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }
  function uid() {
    return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
  }
  const byNewest = (a, b) => b.created_at.localeCompare(a.created_at);

  const local = {
    mode: 'local',

    async getUser() { return null; },
    async signIn() { return null; },
    async signOut() {},

    async listObras() {
      return load().obras.slice().sort(byNewest);
    },
    async createObra(obra) {
      const db = load();
      const row = { ...obra, id: uid(), created_at: new Date().toISOString() };
      db.obras.push(row);
      save(db);
      return row;
    },
    async updateObra(id, obra) {
      const db = load();
      const row = db.obras.find((o) => o.id === id);
      if (!row) throw new Error('La obra ya no existe.');
      Object.assign(row, obra);
      save(db);
      return row;
    },
    async deleteObra(id) {
      const db = load();
      db.obras = db.obras.filter((o) => o.id !== id);
      db.notas = db.notas.filter((n) => n.obra_id !== id);
      save(db);
    },

    async listNotas() {
      return load().notas.slice().sort(byNewest);
    },
    async createNota(obraId, texto, autor) {
      const db = load();
      const row = { id: uid(), obra_id: obraId, texto, autor, created_at: new Date().toISOString() };
      db.notas.push(row);
      save(db);
      return row;
    },
    async deleteNota(id) {
      const db = load();
      db.notas = db.notas.filter((n) => n.id !== id);
      save(db);
    },

    // Sincroniza otras pestañas abiertas del mismo navegador
    subscribe(onChange) {
      window.addEventListener('storage', (e) => { if (e.key === KEY) onChange(); });
    },
  };

  window.Store = useSupabase ? remote : local;
})();
