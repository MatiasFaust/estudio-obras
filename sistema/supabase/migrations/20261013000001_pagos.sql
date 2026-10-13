-- =============================================================================
-- Pagos: monto acordado por obra y registro de pagos del cliente (avance de pago).
-- Información financiera: solo administradores (RLS).
-- =============================================================================

create table public.project_finances (
  project_id      uuid primary key references public.projects (id) on delete cascade,
  agreed_amount   numeric(14, 2) check (agreed_amount >= 0),
  currency        text not null default 'UYU' check (currency in ('UYU', 'USD')),
  notes           text check (char_length(notes) <= 2000),
  updated_at      timestamptz not null default now()
);

create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  paid_on          date not null default current_date,
  amount           numeric(14, 2) not null check (amount > 0),
  currency         text not null check (currency in ('UYU', 'USD')),
  -- Pesos uruguayos por dólar, obligatorio si se paga en otra moneda que la acordada
  exchange_rate    numeric(12, 4) check (exchange_rate > 0),
  -- Monto expresado en la moneda acordada (lo calcula la base)
  amount_contract  numeric(14, 2) not null default 0,
  concept          text not null check (char_length(btrim(concept)) between 1 and 160),
  method           text not null default 'transferencia'
                   check (method in ('transferencia', 'efectivo', 'cheque', 'deposito', 'otro')),
  receipt          text check (char_length(receipt) <= 60),
  notes            text check (char_length(notes) <= 2000),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index payments_project_idx on public.payments (project_id, paid_on desc);

-- Moneda acordada de una obra (si no se definió, la del propio pago)
create or replace function public.contract_currency(p_project uuid)
returns text language sql stable security definer set search_path = public as $$
  select currency from public.project_finances where project_id = p_project
$$;

create or replace function public.convert_payment(p_amount numeric, p_currency text, p_rate numeric, p_target text)
returns numeric language plpgsql immutable as $$
begin
  if p_target is null or p_currency = p_target then return p_amount; end if;
  if p_rate is null then
    raise exception 'Falta la cotización para convertir % a %', p_currency, p_target;
  end if;
  if p_currency = 'UYU' and p_target = 'USD' then return round(p_amount / p_rate, 2); end if;
  return round(p_amount * p_rate, 2); -- USD → UYU
end $$;

create or replace function public.payments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.amount_contract := public.convert_payment(new.amount, new.currency, new.exchange_rate, public.contract_currency(new.project_id));
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end $$;

create trigger payments_before_write before insert or update on public.payments
  for each row execute function public.payments_before_write();

-- Si cambia la moneda acordada, se recalculan los pagos existentes
create or replace function public.finances_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.currency is distinct from old.currency then
    update public.payments set amount_contract = amount_contract where project_id = new.project_id;
  end if;
  return null;
end $$;

create trigger finances_after_write after insert or update on public.project_finances
  for each row execute function public.finances_after_write();

create trigger finances_updated_at before update on public.project_finances
  for each row execute function public.set_updated_at();

-- Historial (visible solo para administradores, ver política más abajo)
create or replace function public.format_money(p_amount numeric, p_currency text)
returns text language sql immutable as $$
  select case when p_currency = 'USD' then 'US$ ' else '$ ' end
         || to_char(p_amount, 'FM999G999G999G990D00')
$$;

create or replace function public.log_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec public.payments;
  pname text;
begin
  rec := coalesce(new, old);
  select format('%s · %s', code, name) into pname from public.projects where id = rec.project_id;
  if pname is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity('payment', new.id, new.project_id, 'created',
      format('registró un pago de %s en %s', public.format_money(new.amount, new.currency), pname));
  elsif tg_op = 'UPDATE' then
    -- Recalcular la conversión no es un cambio hecho por una persona
    if (new.amount, new.currency, new.exchange_rate, new.paid_on, new.concept, new.method, new.receipt, new.notes)
       is not distinct from
       (old.amount, old.currency, old.exchange_rate, old.paid_on, old.concept, old.method, old.receipt, old.notes) then
      return null;
    end if;
    perform public.log_activity('payment', new.id, new.project_id, 'updated',
      format('modificó un pago de %s en %s', public.format_money(new.amount, new.currency), pname));
  else
    perform public.log_activity('payment', old.id, old.project_id, 'deleted',
      format('eliminó un pago de %s en %s', public.format_money(old.amount, old.currency), pname));
  end if;
  return null;
end $$;

create trigger payments_log after insert or update or delete on public.payments
  for each row execute function public.log_payments();

create or replace function public.log_finances()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pname text;
begin
  select format('%s · %s', code, name) into pname from public.projects where id = new.project_id;
  perform public.log_activity('payment', new.project_id, new.project_id, 'agreed',
    format('fijó el monto acordado de %s en %s', pname, coalesce(public.format_money(new.agreed_amount, new.currency), 'sin monto')));
  return null;
end $$;

create trigger finances_log after insert or update of agreed_amount, currency on public.project_finances
  for each row execute function public.log_finances();

-- Row Level Security: solo administradores
alter table public.project_finances enable row level security;
alter table public.payments enable row level security;

create policy finances_admin on public.project_finances for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy payments_admin on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- El historial de pagos tampoco lo ven arquitectos ni colaboradores
drop policy if exists activity_select on public.activity_log;
create policy activity_select on public.activity_log for select to authenticated
  using (
    (entity_type <> 'payment' or public.is_admin())
    and (public.is_staff() or (project_id is not null and public.can_access_project(project_id)))
  );

alter publication supabase_realtime add table public.project_finances, public.payments;
