// Pruebas de la base de datos: aplica las migraciones en un PostgreSQL real (PGlite)
// con una simulación mínima de Supabase, y verifica permisos (RLS), triggers y validaciones.
// Ejecutar: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'supabase');
const MIGRATIONS = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort().map((f) => join(ROOT, 'migrations', f));
const SEED = join(ROOT, 'seed.sql');
let fails = 0;
const check = (c, msg) => { if (!c) fails++; console.log((c ? 'OK   ' : 'FAIL ') + msg); };

const db = new PGlite();

// --- Simulación mínima de Supabase
await db.exec(`
  create role authenticated nologin;
  create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('email', (select email from auth.users where id = auth.uid())) $$;
  grant usage on schema auth to authenticated;
  grant execute on all functions in schema auth to authenticated;
  create publication supabase_realtime;
`);

for (const file of MIGRATIONS) await db.exec(readFileSync(file, 'utf8'));
await db.exec(`
  grant usage on schema public to authenticated;
  grant all on all tables in schema public to authenticated;
  grant all on all sequences in schema public to authenticated;
`);
console.log('OK   migración aplicada sin errores');

const ADMIN = '00000000-0000-0000-0000-000000000001';
const ARQ = '00000000-0000-0000-0000-000000000002';
const COLAB = '00000000-0000-0000-0000-000000000003';
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${ADMIN}', 'admin@estudio.uy', '{"full_name":"Ana Admin"}'),
    ('${ARQ}', 'arq@estudio.uy', '{"full_name":"Bruno Arquitecto"}'),
    ('${COLAB}', 'colab@estudio.uy', '{}');
`);
const profiles = (await db.query('select email, full_name, role from public.profiles order by email')).rows;
check(profiles.length === 3 && profiles.every((p) => p.role === 'colaborador'), 'trigger crea perfiles (rol colaborador por defecto)');

// Primer administrador desde el SQL Editor (sin usuario autenticado)
await db.exec(`update public.profiles set role = 'admin' where email = 'admin@estudio.uy'`);
check((await db.query(`select role from profiles where id = '${ADMIN}'`)).rows[0].role === 'admin', 'SQL Editor puede crear el primer administrador');

// Seed de datos ficticios
await db.exec(readFileSync(SEED, 'utf8'));
console.log('OK   seed.sql aplicado sin errores');

async function as(user, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}
async function fails_(user, sql) {
  try { await as(user, sql); return false; } catch (e) { return e.message; }
}

// --- Administrador nombra arquitecto
await as(ADMIN, `update profiles set role = 'arquitecto' where id = '${ARQ}'`);
check((await db.query(`select role from profiles where id='${ARQ}'`)).rows[0].role === 'arquitecto', 'administrador cambia roles');
const esc = await fails_(COLAB, `update profiles set role = 'admin' where id = '${COLAB}'`);
check(!!esc && /administrador/.test(esc), 'colaborador NO puede auto-asignarse administrador');

// --- Arquitecto crea cliente y obra
const client = (await as(ARQ, `insert into clients (name, phone) values ('Cliente SQL', '099') returning id`)).rows[0].id;
const proj = (await as(ARQ, `insert into projects (name, address, client_id, lat, lng) values ('Obra SQL', 'Calle 1', '${client}', -32.32, -58.08) returning id, code, progress, created_by`)).rows[0];
check(/^OB-\d{4}-\d{3}$/.test(proj.code), `código automático (${proj.code})`);
check(proj.created_by === ARQ, 'created_by = usuario autenticado');
const proj2 = (await as(ARQ, `insert into projects (name, address) values ('Obra SQL 2', 'Calle 2') returning code`)).rows[0];
check(proj2.code > proj.code, `códigos correlativos (${proj.code} → ${proj2.code})`);

// Etapas → avance ponderado
await as(ARQ, `insert into project_stages (project_id, name, weight, progress) values ('${proj.id}', 'A', 40, 100), ('${proj.id}', 'B', 60, 50)`);
let pr = (await db.query(`select progress from projects where id='${proj.id}'`)).rows[0].progress;
check(pr === 70, `avance ponderado por etapas = 70 (${pr})`);
await as(ARQ, `update projects set progress_mode = 'manual', manual_progress = 85 where id = '${proj.id}'`);
pr = (await db.query(`select progress from projects where id='${proj.id}'`)).rows[0].progress;
check(pr === 85, `avance manual = 85 (${pr})`);
await as(ARQ, `update projects set progress = 3 where id = '${proj.id}'`);
pr = (await db.query(`select progress from projects where id='${proj.id}'`)).rows[0].progress;
check(pr === 85, 'el avance no se puede falsear escribiendo la columna');
await as(ARQ, `update projects set code = 'HACK' where id = '${proj.id}'`);
check((await db.query(`select code from projects where id='${proj.id}'`)).rows[0].code === proj.code, 'el código no se puede modificar');

// Validaciones
check(!!(await fails_(ARQ, `insert into projects (name, address, start_date, due_date) values ('X obra', 'Y calle', '2026-05-01', '2026-01-01')`)), 'rechaza fin anterior al inicio');
check(!!(await fails_(ARQ, `insert into clients (name, email) values ('Mal correo', 'no-es-correo')`)), 'rechaza correo inválido');
check(!!(await fails_(ARQ, `insert into projects (name, address, lat) values ('Sin lng', 'Calle', -32)`)), 'rechaza lat sin lng');

// Estado y archivado
await as(ARQ, `update projects set status = 'en_construccion' where id = '${proj.id}'`);
await as(ARQ, `update projects set status = 'archivada' where id = '${proj.id}'`);
const arch = (await db.query(`select status, status_before_archive from projects where id='${proj.id}'`)).rows[0];
check(arch.status === 'archivada' && arch.status_before_archive === 'en_construccion', 'archivar guarda el estado anterior');

// --- Colaborador: sin asignación no ve nada
let seen = (await as(COLAB, `select id from projects`)).rows.length;
check(seen === 0, `colaborador sin asignar ve 0 obras (${seen})`);
check((await as(COLAB, `select id from clients`)).rows.length === 0, 'colaborador sin asignar ve 0 clientes');
await as(ARQ, `insert into project_members (project_id, user_id) values ('${proj.id}', '${COLAB}')`);
seen = (await as(COLAB, `select id from projects`)).rows.length;
check(seen === 1, `colaborador asignado ve solo su obra (${seen})`);
check((await as(COLAB, `select id from clients`)).rows.length === 1, 'colaborador ve solo el cliente de su obra');
const upd = (await as(COLAB, `update projects set name = 'hackeado' where id = '${proj.id}' returning id`)).rows.length;
check(upd === 0, 'colaborador NO puede editar obras (RLS)');
check(!!(await fails_(COLAB, `insert into projects (name, address) values ('Colab obra', 'Calle')`)), 'colaborador NO puede crear obras');
check(!!(await fails_(COLAB, `insert into project_stages (project_id, name) values ('${proj.id}', 'X')`)), 'colaborador NO puede crear etapas');
const del = (await as(ARQ, `delete from projects where id = '${proj.id}' returning id`)).rows.length;
check(del === 0, 'arquitecto NO puede eliminar obras definitivamente (solo admin)');

// Notas
const note = (await as(COLAB, `insert into notes (project_id, title, content_text, author_id) values ('${proj.id}', 'Nota colab', 'texto', '${COLAB}') returning id`)).rows[0].id;
check(!!note, 'colaborador agrega notas en su obra');
const otherId = (await db.query(`select id from projects where name = 'Obra SQL 2'`)).rows[0].id;
check(!!(await fails_(COLAB, `insert into notes (project_id, title, author_id) values ('${otherId}', 'X', '${COLAB}')`)), 'colaborador NO agrega notas en obras ajenas');
check(!!(await fails_(COLAB, `insert into notes (project_id, title, author_id) values (null, 'Suplantación', '${ARQ}')`)), 'no se puede firmar una nota como otro usuario');
const arqNote = (await as(ARQ, `insert into notes (project_id, title, author_id) values ('${proj.id}', 'Nota arq', '${ARQ}') returning id`)).rows[0].id;
const updNote = (await as(COLAB, `update notes set title = 'x' where id = '${arqNote}' returning id`)).rows.length;
check(updNote === 0, 'colaborador NO edita notas ajenas');
const idea = (await as(COLAB, `insert into notes (project_id, title, author_id) values (null, 'Idea general', '${COLAB}') returning id`)).rows[0].id;
check(!!idea, 'colaborador agrega ideas del estudio');

// Historial
const log = (await as(ARQ, `select a.summary, p.full_name from activity_log a left join profiles p on p.id = a.actor_id order by a.id`)).rows;
const summaries = log.map((l) => l.summary).join('\n');
check(summaries.includes('creó la obra') && summaries.includes('cambió el estado') && summaries.includes('archivó la obra') && summaries.includes('agregó la etapa') && summaries.includes('ajustó manualmente'), 'historial automático de obra, estado, etapas y avance');
check(log.some((l) => l.summary.includes('Nota colab') && l.full_name === 'colab'), 'historial registra el autor de cada cambio');
check(!!(await fails_(ARQ, `insert into activity_log (entity_type, action, summary) values ('x','x','falso')`)), 'nadie puede escribir el historial a mano');
const colabLog = (await as(COLAB, `select count(*)::int as n from activity_log where project_id is null`)).rows[0].n;
check(colabLog === 0, 'colaborador no ve historial general (solo de sus obras)');

// Clientes: no borrar con obras
await db.exec(`update profiles set role = 'admin' where id = '${ADMIN}'`);
check(!!(await fails_(ADMIN, `delete from clients where id = '${client}'`)), 'no se puede borrar un cliente con obras (FK restrict)');
// Admin elimina obra (cascada de etapas y notas)
const delAdmin = (await as(ADMIN, `delete from projects where id = '${proj.id}' returning id`)).rows.length;
check(delAdmin === 1, 'administrador elimina obra');
const orphan = (await db.query(`select (select count(*) from project_stages where project_id='${proj.id}')::int s, (select count(*) from notes where project_id='${proj.id}')::int n`)).rows[0];
check(orphan.s === 0 && orphan.n === 0, 'eliminar obra borra sus etapas y notas');

// Seed visible
const seedCount = (await as(ADMIN, `select count(*)::int as n from projects where name like '%(DEMO)%'`)).rows[0].n;
check(seedCount > 0, `seed: ${seedCount} obras ficticias marcadas (DEMO)`);

console.log(fails ? `${fails} pruebas SQL fallaron` : 'Todas las pruebas SQL pasaron');
process.exit(fails ? 1 : 0);
