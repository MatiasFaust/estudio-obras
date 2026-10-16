-- =============================================================================
-- Estudio de desarrollo: casas y terrenos propios en alquiler.
-- Propiedades, inquilinos, contratos y cobros mensuales.
-- También agrega el acceso por área (arquitectura / desarrollo) a cada usuario.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Acceso por área
-- ---------------------------------------------------------------------------
-- arquitectura: si el usuario entra al estudio de arquitectura (con su rol de siempre).
-- desarrollo:   'admin' (todo, incluidos montos), 'colaborador' (solo propiedades y mapa)
--               o null (sin acceso).
alter table public.profiles
  add column arquitectura boolean not null default true,
  add column desarrollo   text check (desarrollo in ('admin', 'colaborador'));

-- Los administradores actuales también administran el área de desarrollo
update public.profiles set desarrollo = 'admin' where role = 'admin';

-- El rol de arquitectura solo cuenta si el usuario tiene acceso a esa área
create or replace function public.current_user_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active and arquitectura
$$;

create or replace function public.current_dev_role()
returns text language sql stable security definer set search_path = public as $$
  select desarrollo from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_dev_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_dev_role() is not null
$$;

create or replace function public.is_dev_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_dev_role() = 'admin', false)
$$;

-- Solo un administrador puede cambiar roles, accesos o desactivar usuarios
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- SQL Editor
  if not public.is_admin()
     and (new.role is distinct from old.role or new.active is distinct from old.active
          or new.email is distinct from old.email or new.arquitectura is distinct from old.arquitectura) then
    raise exception 'Solo un administrador puede cambiar roles o el estado de un usuario';
  end if;
  if not public.is_dev_admin() and new.desarrollo is distinct from old.desarrollo then
    raise exception 'Solo un administrador de desarrollo puede cambiar el acceso a desarrollo';
  end if;
  return new;
end $$;

-- Cada área ve a sus integrantes
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (public.is_member() or public.is_dev_member() or id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.dev_properties (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 120),
  kind         text not null default 'casa' check (kind in ('casa', 'apartamento', 'terreno', 'local', 'otro')),
  status       text not null default 'desocupada'
               check (status in ('alquilada', 'desocupada', 'en_construccion', 'terreno_baldio', 'alquiler_por_dia')),
  address      text not null default '' check (char_length(address) <= 200),
  locality     text not null default 'Paysandú' check (char_length(locality) <= 80),
  department   text not null default 'Paysandú' check (char_length(department) <= 40),
  padron       text check (char_length(padron) <= 30),
  lat          double precision check (lat between -90 and 90),
  lng          double precision check (lng between -180 and 180),
  bedrooms     smallint check (bedrooms between 0 and 50),
  area_m2      numeric(10, 2) check (area_m2 > 0),
  notes        text check (char_length(notes) <= 4000),
  archived_at  timestamptz,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((lat is null) = (lng is null))
);

create table public.dev_tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 160),
  document    text check (char_length(document) <= 20),
  phone       text check (char_length(phone) <= 40),
  email       text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  notes       text check (char_length(notes) <= 4000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Contrato de alquiler: una casa, un inquilino, un monto mensual
create table public.dev_leases (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.dev_properties (id) on delete cascade,
  tenant_id      uuid not null references public.dev_tenants (id) on delete restrict,
  start_date     date not null,
  end_date       date,
  -- Fecha en que el contrato terminó antes de tiempo (o se entregó la casa)
  terminated_on  date,
  rent_amount    numeric(14, 2) not null check (rent_amount > 0),
  currency       text not null default 'UYU' check (currency in ('UYU', 'USD')),
  -- Día del mes en que vence el alquiler
  due_day        smallint not null default 10 check (due_day between 1 and 28),
  deposit        numeric(14, 2) check (deposit >= 0),
  notes          text check (char_length(notes) <= 4000),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (terminated_on is null or terminated_on >= start_date)
);

create index dev_leases_property_idx on public.dev_leases (property_id, start_date desc);
create index dev_leases_tenant_idx on public.dev_leases (tenant_id);

-- Cobro de un mes de alquiler (puede haber varios pagos parciales por mes).
-- El monto está en la moneda del contrato.
create table public.dev_rent_payments (
  id          uuid primary key default gen_random_uuid(),
  lease_id    uuid not null references public.dev_leases (id) on delete cascade,
  -- Mes que se paga (siempre el día 1)
  period      date not null check (extract(day from period) = 1),
  paid_on     date not null default current_date,
  amount      numeric(14, 2) not null check (amount > 0),
  method      text not null default 'transferencia'
              check (method in ('transferencia', 'efectivo', 'cheque', 'deposito', 'otro')),
  receipt     text check (char_length(receipt) <= 60),
  notes       text check (char_length(notes) <= 2000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index dev_rent_payments_lease_idx on public.dev_rent_payments (lease_id, period desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger dev_properties_updated_at before update on public.dev_properties for each row execute function public.set_updated_at();
create trigger dev_tenants_updated_at    before update on public.dev_tenants    for each row execute function public.set_updated_at();
create trigger dev_payments_updated_at   before update on public.dev_rent_payments for each row execute function public.set_updated_at();

-- Último día en que el contrato está vigente (null = sin fecha de fin)
create or replace function public.dev_lease_last_day(l public.dev_leases)
returns date language sql immutable as $$
  select least(coalesce(l.terminated_on, 'infinity'::date), coalesce(l.end_date, 'infinity'::date))
$$;

-- Una casa no puede tener dos contratos vigentes al mismo tiempo
create or replace function public.dev_leases_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.dev_leases l
    where l.property_id = new.property_id and l.id <> new.id
      and l.start_date <= public.dev_lease_last_day(new)
      and new.start_date <= public.dev_lease_last_day(l)
  ) then
    raise exception 'La propiedad ya tiene un contrato en esas fechas';
  end if;
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger dev_leases_before_write before insert or update on public.dev_leases
  for each row execute function public.dev_leases_before_write();

-- La casa pasa a "alquilada" con un contrato vigente y a "desocupada" cuando termina
create or replace function public.dev_leases_sync_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.property_id, old.property_id);
  vigente boolean;
begin
  select exists (
    select 1 from public.dev_leases l
    where l.property_id = pid and l.start_date <= current_date and public.dev_lease_last_day(l) >= current_date
  ) into vigente;
  if vigente then
    update public.dev_properties set status = 'alquilada' where id = pid and status <> 'alquilada';
  else
    update public.dev_properties set status = 'desocupada' where id = pid and status = 'alquilada';
  end if;
  return null;
end $$;

create trigger dev_leases_sync_status after insert or update or delete on public.dev_leases
  for each row execute function public.dev_leases_sync_status();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.dev_properties    enable row level security;
alter table public.dev_tenants       enable row level security;
alter table public.dev_leases        enable row level security;
alter table public.dev_rent_payments enable row level security;

-- Propiedades: las ve todo el equipo de desarrollo; las cambia el administrador
create policy dev_properties_select on public.dev_properties for select to authenticated using (public.is_dev_member());
create policy dev_properties_insert on public.dev_properties for insert to authenticated with check (public.is_dev_admin());
create policy dev_properties_update on public.dev_properties for update to authenticated
  using (public.is_dev_admin()) with check (public.is_dev_admin());
create policy dev_properties_delete on public.dev_properties for delete to authenticated using (public.is_dev_admin());

-- Inquilinos, contratos y cobros: solo administradores de desarrollo
create policy dev_tenants_admin on public.dev_tenants for all to authenticated
  using (public.is_dev_admin()) with check (public.is_dev_admin());
create policy dev_leases_admin on public.dev_leases for all to authenticated
  using (public.is_dev_admin()) with check (public.is_dev_admin());
create policy dev_payments_admin on public.dev_rent_payments for all to authenticated
  using (public.is_dev_admin()) with check (public.is_dev_admin());

-- ---------------------------------------------------------------------------
-- Tiempo real
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.dev_properties, public.dev_tenants, public.dev_leases, public.dev_rent_payments;
