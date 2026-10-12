-- Base de datos de obras y notas.
-- Ejecutar completo en Supabase → SQL Editor → New query → Run.

create table if not exists public.obras (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(nombre) between 1 and 120),
  direccion   text not null check (char_length(direccion) between 1 and 200),
  padron      text check (char_length(padron) <= 30),
  cliente     text check (char_length(cliente) <= 120),
  descripcion text check (char_length(descripcion) <= 1000),
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null
);

create table if not exists public.notas (
  id          uuid primary key default gen_random_uuid(),
  obra_id     uuid not null references public.obras (id) on delete cascade,
  texto       text not null check (char_length(texto) between 1 and 2000),
  autor       text default (auth.jwt() ->> 'email'),
  created_at  timestamptz not null default now()
);

create index if not exists notas_obra_id_idx on public.notas (obra_id);

-- Seguridad: solo usuarios con sesión iniciada (integrantes del estudio) pueden leer y modificar.
-- Las cuentas se crean a mano desde Authentication → Users, con el registro público desactivado.
alter table public.obras enable row level security;
alter table public.notas enable row level security;

drop policy if exists "Integrantes gestionan obras" on public.obras;
create policy "Integrantes gestionan obras" on public.obras
  for all to authenticated using (true) with check (true);

drop policy if exists "Integrantes gestionan notas" on public.notas;
create policy "Integrantes gestionan notas" on public.notas
  for all to authenticated using (true) with check (true);

-- Actualización en tiempo real entre dispositivos
do $$
begin
  alter publication supabase_realtime add table public.obras;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.notas;
exception when duplicate_object then null;
end $$;
