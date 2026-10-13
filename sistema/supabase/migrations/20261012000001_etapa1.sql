-- =============================================================================
-- Etapa 1: perfiles, clientes, obras, etapas, notas e historial de actividad.
-- Ejecutar en Supabase → SQL Editor (o con `supabase db push`).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'arquitecto', 'colaborador');

create type public.project_status as enum (
  'anteproyecto', 'proyecto_ejecutivo', 'tramites', 'planificada',
  'en_construccion', 'pausada', 'finalizada', 'archivada'
);

create type public.note_category as enum ('idea', 'observacion', 'pendiente', 'importante');

create type public.client_kind as enum ('persona', 'empresa');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  email       text not null,
  role        public.user_role not null default 'colaborador',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.clients (
  id           uuid primary key default gen_random_uuid(),
  kind         public.client_kind not null default 'persona',
  name         text not null check (char_length(btrim(name)) between 2 and 160),
  document     text check (char_length(document) <= 20),
  phone        text check (char_length(phone) <= 40),
  email        text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address      text check (char_length(address) <= 200),
  notes        text check (char_length(notes) <= 4000),
  archived_at  timestamptz,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.projects (
  id                     uuid primary key default gen_random_uuid(),
  code                   text not null unique,
  name                   text not null check (char_length(btrim(name)) between 2 and 160),
  client_id              uuid references public.clients (id) on delete restrict,
  address                text not null check (char_length(btrim(address)) between 2 and 200),
  locality               text not null default 'Paysandú' check (char_length(locality) <= 80),
  department             text not null default 'Paysandú' check (char_length(department) <= 40),
  padron                 text check (char_length(padron) <= 30),
  lat                    double precision check (lat between -90 and 90),
  lng                    double precision check (lng between -180 and 180),
  project_type           text not null default 'vivienda' check (project_type in
                           ('vivienda', 'edificio', 'reforma', 'ampliacion', 'comercial',
                            'industrial', 'institucional', 'otro')),
  description            text check (char_length(description) <= 4000),
  responsible_id         uuid references public.profiles (id) on delete set null,
  start_date             date,
  due_date               date,
  status                 public.project_status not null default 'anteproyecto',
  status_before_archive  public.project_status,
  progress_mode          text not null default 'etapas' check (progress_mode in ('etapas', 'manual')),
  manual_progress        smallint check (manual_progress between 0 and 100),
  progress               smallint not null default 0 check (progress between 0 and 100),
  created_by             uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date),
  check ((lat is null) = (lng is null))
);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_stages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  position    integer not null default 0,
  weight      smallint not null default 1 check (weight between 1 and 100),
  progress    smallint not null default 0 check (progress between 0 and 100),
  start_date  date,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects (id) on delete cascade, -- null = "Ideas del estudio"
  title         text not null check (char_length(btrim(title)) between 1 and 160),
  content       jsonb not null default '{}'::jsonb,
  content_text  text not null default '' check (char_length(content_text) <= 20000),
  category      public.note_category not null default 'idea',
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles (id) on delete set null,
  author_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.activity_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid references public.profiles (id) on delete set null,
  entity_type  text not null,
  entity_id    uuid,
  project_id   uuid references public.projects (id) on delete set null,
  action       text not null,
  summary      text not null,
  created_at   timestamptz not null default now()
);

create table public.project_code_counters (
  year  integer primary key,
  last  integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index projects_status_idx       on public.projects (status);
create index projects_client_idx       on public.projects (client_id);
create index projects_responsible_idx  on public.projects (responsible_id);
create index project_members_user_idx  on public.project_members (user_id);
create index project_stages_project_idx on public.project_stages (project_id, position);
create index notes_project_idx         on public.notes (project_id, created_at desc);
create index activity_created_idx      on public.activity_log (created_at desc);
create index activity_project_idx      on public.activity_log (project_id, created_at desc);
create index clients_name_idx          on public.clients (lower(name));

-- ---------------------------------------------------------------------------
-- Funciones de permisos (security definer: evitan recursión de RLS)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_user_role() is not null
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'arquitecto'), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.can_access_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or (public.is_member() and exists (
            select 1 from public.project_members m
            where m.project_id = p_project and m.user_id = auth.uid()))
$$;

-- ---------------------------------------------------------------------------
-- Triggers de soporte
-- ---------------------------------------------------------------------------

-- Perfil automático al crear un usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Solo un administrador puede cambiar roles o desactivar usuarios.
-- (Desde el SQL Editor, sin usuario autenticado, se permite para crear el primer administrador.)
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and (new.role is distinct from old.role or new.active is distinct from old.active
          or new.email is distinct from old.email) then
    raise exception 'Solo un administrador puede cambiar roles o el estado de un usuario';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger clients_updated_at  before update on public.clients        for each row execute function public.set_updated_at();
create trigger stages_updated_at   before update on public.project_stages for each row execute function public.set_updated_at();
create trigger notes_updated_at    before update on public.notes          for each row execute function public.set_updated_at();

-- Código único de obra: OB-AAAA-NNN
create or replace function public.next_project_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  y integer := extract(year from now())::integer;
  n integer;
begin
  insert into public.project_code_counters (year, last) values (y, 1)
  on conflict (year) do update set last = public.project_code_counters.last + 1
  returning last into n;
  return format('OB-%s-%s', y, lpad(n::text, 3, '0'));
end $$;

-- Avance: manual, o promedio ponderado de las etapas
create or replace function public.compute_project_progress(p_project uuid, p_mode text, p_manual smallint)
returns smallint language sql stable security definer set search_path = public as $$
  select case
    when p_mode = 'manual' then coalesce(p_manual, 0)
    else coalesce((
      select round(sum(weight * progress)::numeric / nullif(sum(weight), 0))::smallint
      from public.project_stages where project_id = p_project), 0)
  end
$$;

create or replace function public.projects_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (new.code is null or new.code = '') then
    new.code := public.next_project_code();
  end if;
  if tg_op = 'UPDATE' then
    new.code := old.code;               -- el código no se modifica
    new.created_by := old.created_by;
    new.updated_at := now();
    -- Archivar / desarchivar guarda el estado anterior
    if new.status = 'archivada' and old.status <> 'archivada' then
      new.status_before_archive := old.status;
    end if;
  end if;
  new.progress := public.compute_project_progress(new.id, new.progress_mode, new.manual_progress);
  return new;
end $$;

create trigger projects_before_write before insert or update on public.projects
  for each row execute function public.projects_before_write();

-- Recalcular el avance cuando cambian las etapas
create or replace function public.stages_refresh_progress()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.projects set progress = progress
  where id = coalesce(new.project_id, old.project_id);
  return null;
end $$;

create trigger stages_refresh_progress after insert or update or delete on public.project_stages
  for each row execute function public.stages_refresh_progress();

-- ---------------------------------------------------------------------------
-- Historial de actividad (escrito solo por triggers)
-- ---------------------------------------------------------------------------
create or replace function public.status_label(s public.project_status)
returns text language sql immutable as $$
  select case s
    when 'anteproyecto' then 'Anteproyecto'
    when 'proyecto_ejecutivo' then 'Proyecto ejecutivo'
    when 'tramites' then 'Trámites y permisos'
    when 'planificada' then 'Obra planificada'
    when 'en_construccion' then 'En construcción'
    when 'pausada' then 'Pausada'
    when 'finalizada' then 'Finalizada'
    when 'archivada' then 'Archivada'
  end
$$;

create or replace function public.log_activity(
  p_entity_type text, p_entity_id uuid, p_project uuid, p_action text, p_summary text)
returns void language sql security definer set search_path = public as $$
  insert into public.activity_log (actor_id, entity_type, entity_id, project_id, action, summary)
  values (auth.uid(), p_entity_type, p_entity_id, p_project, p_action, p_summary)
$$;

create or replace function public.log_clients()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('client', new.id, null, 'created', format('registró el cliente %s', new.name));
  elsif tg_op = 'UPDATE' then
    if new.archived_at is not null and old.archived_at is null then
      perform public.log_activity('client', new.id, null, 'archived', format('archivó el cliente %s', new.name));
    elsif new.archived_at is null and old.archived_at is not null then
      perform public.log_activity('client', new.id, null, 'restored', format('restauró el cliente %s', new.name));
    else
      perform public.log_activity('client', new.id, null, 'updated', format('actualizó el cliente %s', new.name));
    end if;
  else
    perform public.log_activity('client', old.id, null, 'deleted', format('eliminó el cliente %s', old.name));
  end if;
  return null;
end $$;

create trigger clients_log after insert or update or delete on public.clients
  for each row execute function public.log_clients();

create or replace function public.log_projects()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  label text;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('project', new.id, new.id, 'created',
      format('creó la obra %s · %s', new.code, new.name));
  elsif tg_op = 'UPDATE' then
    label := format('%s · %s', new.code, new.name);
    if new.status is distinct from old.status then
      if new.status = 'archivada' then
        perform public.log_activity('project', new.id, new.id, 'archived', format('archivó la obra %s', label));
      elsif old.status = 'archivada' then
        perform public.log_activity('project', new.id, new.id, 'restored', format('restauró la obra %s', label));
      else
        perform public.log_activity('project', new.id, new.id, 'status',
          format('cambió el estado de %s: %s → %s', label, public.status_label(old.status), public.status_label(new.status)));
      end if;
    elsif new.progress_mode = 'manual' and new.manual_progress is distinct from old.manual_progress then
      perform public.log_activity('project', new.id, new.id, 'progress',
        format('ajustó manualmente el avance de %s a %s%%', label, new.manual_progress));
    elsif (new.name, new.client_id, new.address, new.locality, new.padron, new.lat, new.lng, new.project_type,
           new.description, new.responsible_id, new.start_date, new.due_date, new.progress_mode)
          is distinct from
          (old.name, old.client_id, old.address, old.locality, old.padron, old.lat, old.lng, old.project_type,
           old.description, old.responsible_id, old.start_date, old.due_date, old.progress_mode) then
      perform public.log_activity('project', new.id, new.id, 'updated', format('actualizó la obra %s', label));
    end if;
  else
    perform public.log_activity('project', old.id, null, 'deleted', format('eliminó la obra %s · %s', old.code, old.name));
  end if;
  return null;
end $$;

create trigger projects_log after insert or update or delete on public.projects
  for each row execute function public.log_projects();

create or replace function public.log_stages()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text;
begin
  select format('%s · %s', code, name) into pname from public.projects
  where id = coalesce(new.project_id, old.project_id);
  if pname is null then return null; end if; -- la obra se está eliminando
  if tg_op = 'INSERT' then
    perform public.log_activity('stage', new.id, new.project_id, 'created',
      format('agregó la etapa "%s" en %s', new.name, pname));
  elsif tg_op = 'UPDATE' then
    if new.progress is distinct from old.progress then
      perform public.log_activity('stage', new.id, new.project_id, 'progress',
        format('actualizó la etapa "%s" de %s a %s%%', new.name, pname, new.progress));
    elsif (new.name, new.weight, new.start_date, new.due_date) is distinct from
          (old.name, old.weight, old.start_date, old.due_date) then
      perform public.log_activity('stage', new.id, new.project_id, 'updated',
        format('modificó la etapa "%s" de %s', new.name, pname));
    end if;
  else
    perform public.log_activity('stage', old.id, old.project_id, 'deleted',
      format('eliminó la etapa "%s" de %s', old.name, pname));
  end if;
  return null;
end $$;

create trigger stages_log after insert or update or delete on public.project_stages
  for each row execute function public.log_stages();

create or replace function public.log_notes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  place text;
  rec public.notes;
begin
  rec := coalesce(new, old);
  if rec.project_id is null then
    place := 'en Ideas del estudio';
  else
    select format('en %s · %s', code, name) into place from public.projects where id = rec.project_id;
    if place is null then return null; end if;
  end if;
  if tg_op = 'INSERT' then
    perform public.log_activity('note', new.id, new.project_id, 'created', format('agregó la nota "%s" %s', new.title, place));
  elsif tg_op = 'UPDATE' then
    if new.resolved_at is not null and old.resolved_at is null then
      perform public.log_activity('note', new.id, new.project_id, 'resolved', format('resolvió la nota "%s" %s', new.title, place));
    elsif new.resolved_at is null and old.resolved_at is not null then
      perform public.log_activity('note', new.id, new.project_id, 'reopened', format('reabrió la nota "%s" %s', new.title, place));
    else
      perform public.log_activity('note', new.id, new.project_id, 'updated', format('editó la nota "%s" %s', new.title, place));
    end if;
  else
    perform public.log_activity('note', old.id, old.project_id, 'deleted', format('eliminó la nota "%s" %s', old.title, place));
  end if;
  return null;
end $$;

create trigger notes_log after insert or update or delete on public.notes
  for each row execute function public.log_notes();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.clients               enable row level security;
alter table public.projects              enable row level security;
alter table public.project_members       enable row level security;
alter table public.project_stages        enable row level security;
alter table public.notes                 enable row level security;
alter table public.activity_log          enable row level security;
alter table public.project_code_counters enable row level security; -- sin políticas: solo vía funciones

-- Perfiles
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_member() or id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Clientes
create policy clients_select on public.clients for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.projects p where p.client_id = clients.id and public.can_access_project(p.id)));
create policy clients_insert on public.clients for insert to authenticated with check (public.is_staff());
create policy clients_update on public.clients for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

-- Obras
create policy projects_select on public.projects for select to authenticated
  using (public.can_access_project(id));
create policy projects_insert on public.projects for insert to authenticated with check (public.is_staff());
create policy projects_update on public.projects for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

-- Integrantes por obra
create policy members_select on public.project_members for select to authenticated
  using (public.can_access_project(project_id));
create policy members_insert on public.project_members for insert to authenticated with check (public.is_staff());
create policy members_delete on public.project_members for delete to authenticated using (public.is_staff());

-- Etapas
create policy stages_select on public.project_stages for select to authenticated
  using (public.can_access_project(project_id));
create policy stages_insert on public.project_stages for insert to authenticated with check (public.is_staff());
create policy stages_update on public.project_stages for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy stages_delete on public.project_stages for delete to authenticated using (public.is_staff());

-- Notas
create policy notes_select on public.notes for select to authenticated
  using ((project_id is null and public.is_member()) or public.can_access_project(project_id));
create policy notes_insert on public.notes for insert to authenticated
  with check (author_id = auth.uid()
    and ((project_id is null and public.is_member()) or public.can_access_project(project_id)));
create policy notes_update on public.notes for update to authenticated
  using ((author_id = auth.uid() and public.is_member()) or public.is_staff())
  with check ((project_id is null and public.is_member()) or public.can_access_project(project_id));
create policy notes_delete on public.notes for delete to authenticated
  using ((author_id = auth.uid() and public.is_member()) or public.is_staff());

-- Historial
create policy activity_select on public.activity_log for select to authenticated
  using (public.is_staff() or (project_id is not null and public.can_access_project(project_id)));

-- ---------------------------------------------------------------------------
-- Tiempo real
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.clients, public.projects, public.project_members, public.project_stages,
  public.notes, public.activity_log;
