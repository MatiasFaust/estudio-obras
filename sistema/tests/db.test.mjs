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

// --- Pagos (solo administradores)
await db.exec(`update profiles set role = 'admin' where id = '${ADMIN}'`);
const payProj = (await db.query(`select id from projects where name = 'Obra SQL 2'`)).rows[0].id;
await as(ADMIN, `insert into project_finances (project_id, agreed_amount, currency) values ('${payProj}', 1000, 'USD')`);
await as(ADMIN, `insert into payments (project_id, amount, currency, concept) values ('${payProj}', 300, 'USD', 'Adelanto')`);
await as(ADMIN, `insert into payments (project_id, amount, currency, exchange_rate, concept) values ('${payProj}', 8000, 'UYU', 40, 'Pago en pesos')`);
const paid = (await db.query(`select sum(amount_contract)::float as s from payments where project_id = '${payProj}'`)).rows[0].s;
check(paid === 500, `pago en pesos convertido con cotización (total en USD = ${paid})`);
check(!!(await fails_(ADMIN, `insert into payments (project_id, amount, currency, concept) values ('${payProj}', 100, 'UYU', 'Sin cotización')`)), 'exige cotización si la moneda difiere de la acordada');
check(!!(await fails_(ADMIN, `insert into payments (project_id, amount, currency, concept) values ('${payProj}', -5, 'USD', 'Negativo')`)), 'rechaza montos negativos');
await as(ADMIN, `update payments set exchange_rate = 40 where project_id = '${payProj}' and currency = 'USD'`);
await as(ADMIN, `update project_finances set currency = 'UYU', agreed_amount = 40000 where project_id = '${payProj}'`);
const paidUyu = (await db.query(`select sum(amount_contract)::float as s from payments where project_id = '${payProj}'`)).rows[0].s;
check(paidUyu === 20000, `cambiar la moneda acordada recalcula los pagos (total en UYU = ${paidUyu})`);
check((await as(ARQ, `select id from payments`)).rows.length === 0, 'arquitecto NO ve pagos');
check((await as(ARQ, `select project_id from project_finances`)).rows.length === 0, 'arquitecto NO ve montos acordados');
check(!!(await fails_(ARQ, `insert into payments (project_id, amount, currency, concept) values ('${payProj}', 1, 'UYU', 'x')`)), 'arquitecto NO registra pagos');
check((await as(ARQ, `select id from activity_log where entity_type = 'payment'`)).rows.length === 0, 'arquitecto NO ve el historial de pagos');
check((await as(ADMIN, `select id from activity_log where entity_type = 'payment'`)).rows.length >= 3, 'administrador ve el historial de pagos');

// Clientes: no borrar con obras
await db.exec(`update profiles set role = 'admin' where id = '${ADMIN}'`);
check(!!(await fails_(ADMIN, `delete from clients where id = '${client}'`)), 'no se puede borrar un cliente con obras (FK restrict)');
// Admin elimina obra (cascada de etapas y notas)
const delAdmin = (await as(ADMIN, `delete from projects where id = '${proj.id}' returning id`)).rows.length;
check(delAdmin === 1, 'administrador elimina obra');
const orphan = (await db.query(`select (select count(*) from project_stages where project_id='${proj.id}')::int s, (select count(*) from notes where project_id='${proj.id}')::int n`)).rows[0];
check(orphan.s === 0 && orphan.n === 0, 'eliminar obra borra sus etapas y notas');

// --- Estudio de desarrollo
const DEVCOLAB = '00000000-0000-0000-0000-000000000004';
await db.exec(`insert into auth.users (id, email) values ('${DEVCOLAB}', 'dev@rfm.uy')`);
await db.exec(`update profiles set desarrollo = 'admin' where id = '${ADMIN}'`);
await db.exec(`update profiles set arquitectura = false, desarrollo = 'colaborador' where id = '${DEVCOLAB}'`);
check((await db.query(`select arquitectura, desarrollo from profiles where id = '${COLAB}'`)).rows[0].arquitectura === true, 'usuarios nuevos: acceso a arquitectura por defecto, sin desarrollo');
const devEsc = await fails_(COLAB, `update profiles set desarrollo = 'admin' where id = '${COLAB}'`);
check(!!devEsc && /desarrollo/.test(devEsc), 'nadie puede darse acceso a desarrollo a sí mismo');
check(!!(await fails_(DEVCOLAB, `update profiles set arquitectura = true where id = '${DEVCOLAB}'`)), 'usuario de desarrollo NO puede darse acceso a arquitectura');

const house = (await as(ADMIN, `insert into dev_properties (name, address, lat, lng) values ('Casa SQL', 'Calle 3', -32.33, -58.09) returning id, status`)).rows[0];
check(house.status === 'desocupada', 'propiedad nueva queda desocupada');
const lot = (await as(ADMIN, `insert into dev_properties (name, kind, status) values ('Terreno SQL', 'terreno', 'terreno_baldio') returning id`)).rows[0].id;
const tenant = (await as(ADMIN, `insert into dev_tenants (name, phone) values ('Inquilino SQL', '099 111') returning id`)).rows[0].id;
const lease = (await as(ADMIN, `insert into dev_leases (property_id, tenant_id, start_date, end_date, rent_amount, currency)
  values ('${house.id}', '${tenant}', current_date - 40, current_date + 300, 25000, 'UYU') returning id`)).rows[0].id;
const st = async (id) => (await db.query(`select status from dev_properties where id = '${id}'`)).rows[0].status;
check((await st(house.id)) === 'alquilada', 'contrato vigente → la casa pasa a "alquilada"');
const overlap = await fails_(ADMIN, `insert into dev_leases (property_id, tenant_id, start_date, rent_amount) values ('${house.id}', '${tenant}', current_date, 1000)`);
check(!!overlap && /contrato/.test(overlap), 'no permite dos contratos superpuestos en la misma casa');
await as(ADMIN, `insert into dev_rent_payments (lease_id, period, amount) values ('${lease}', date_trunc('month', current_date)::date, 25000)`);
check(!!(await fails_(ADMIN, `insert into dev_rent_payments (lease_id, period, amount) values ('${lease}', '2026-05-15', 100)`)), 'el mes cobrado siempre es el día 1');
check(!!(await fails_(ADMIN, `insert into dev_rent_payments (lease_id, period, amount) values ('${lease}', '2026-05-01', 0)`)), 'rechaza cobros en cero');
check(!!(await fails_(ADMIN, `delete from dev_tenants where id = '${tenant}'`)), 'no se puede borrar un inquilino con contratos');

check((await as(DEVCOLAB, `select id from dev_properties`)).rows.length === 2, 'colaborador de desarrollo ve las propiedades');
check((await as(DEVCOLAB, `select id from dev_tenants`)).rows.length === 0, 'colaborador de desarrollo NO ve inquilinos');
check((await as(DEVCOLAB, `select id from dev_leases`)).rows.length === 0, 'colaborador de desarrollo NO ve contratos');
check((await as(DEVCOLAB, `select id from dev_rent_payments`)).rows.length === 0, 'colaborador de desarrollo NO ve cobros');
check(!!(await fails_(DEVCOLAB, `insert into dev_properties (name) values ('Intruso')`)), 'colaborador de desarrollo NO crea propiedades');
check((await as(DEVCOLAB, `select id from projects`)).rows.length === 0, 'usuario solo de desarrollo NO ve obras del estudio');
check((await as(DEVCOLAB, `select id from notes`)).rows.length === 0, 'usuario solo de desarrollo NO ve notas ni ideas del estudio');
check((await as(ARQ, `select id from dev_properties`)).rows.length === 0, 'arquitecto sin acceso a desarrollo NO ve propiedades');

await as(ADMIN, `update dev_leases set terminated_on = current_date - 1 where id = '${lease}'`);
check((await st(house.id)) === 'desocupada', 'al terminar el contrato la casa vuelve a "desocupada"');
check((await st(lot)) === 'terreno_baldio', 'terreno baldío conserva su estado');
await as(ADMIN, `delete from dev_properties where id = '${house.id}'`);
check((await db.query(`select count(*)::int as n from dev_leases where id = '${lease}'`)).rows[0].n === 0, 'borrar una propiedad borra sus contratos y cobros');

// Seed visible
const seedCount = (await as(ADMIN, `select count(*)::int as n from projects where name like '%(DEMO)%'`)).rows[0].n;
check(seedCount > 0, `seed: ${seedCount} obras ficticias marcadas (DEMO)`);

console.log(fails ? `${fails} pruebas SQL fallaron` : 'Todas las pruebas SQL pasaron');
process.exit(fails ? 1 : 0);
