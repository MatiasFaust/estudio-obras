-- =============================================================================
-- Pagos de presupuestos sin obra: se registran en el propio presupuesto.
--  - Cada pago es de una obra o de un presupuesto (uno de los dos).
--  - En un presupuesto sin obra, lo acordado son sus honorarios, en su moneda.
--  - Si después se vincula el presupuesto a una obra, sus pagos pasan a la obra.
--  - Si se borra el presupuesto, se borran sus pagos.
-- =============================================================================

alter table public.payments alter column project_id drop not null;
alter table public.payments
  add column budget_id uuid references public.budgets (id) on delete cascade,
  add constraint payments_owner_check check (num_nonnulls(project_id, budget_id) = 1);

create index payments_budget_idx on public.payments (budget_id, paid_on desc);

-- Moneda acordada: la de la obra o, en un pago de presupuesto, la del presupuesto
create or replace function public.payments_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.amount_contract := public.convert_payment(new.amount, new.currency, new.exchange_rate,
    case when new.project_id is not null then public.contract_currency(new.project_id)
         else (select currency from public.budgets where id = new.budget_id) end);
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end $$;

-- Presupuesto vinculado a una obra → sus pagos pasan a la obra.
-- Si cambia la moneda de un presupuesto sin obra, se recalculan sus pagos.
create or replace function public.budgets_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.project_id is null and new.project_id is not null then
    update public.payments set project_id = new.project_id, budget_id = null where budget_id = new.id;
  elsif new.currency is distinct from old.currency then
    update public.payments set amount_contract = amount_contract where budget_id = new.id;
  end if;
  return null;
end $$;

-- Se ejecuta después de budgets_accept (orden alfabético): la obra ya tiene su monto acordado
create trigger budgets_payments after update of project_id, currency on public.budgets
  for each row execute function public.budgets_payments();

-- Historial: también para pagos de un presupuesto sin obra
create or replace function public.log_payments()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec public.payments;
  place text;
begin
  rec := coalesce(new, old);
  if rec.project_id is not null then
    select format('%s · %s', code, name) into place from public.projects where id = rec.project_id;
  else
    select case when number <> '' then format('el presupuesto %s', number) else 'un presupuesto' end
           || case when client_name <> '' then format(' (%s)', client_name) else '' end
      into place from public.budgets where id = rec.budget_id;
  end if;
  if place is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.log_activity('payment', new.id, new.project_id, 'created',
      format('registró un pago de %s en %s', public.format_money(new.amount, new.currency), place));
  elsif tg_op = 'UPDATE' then
    -- Recalcular la conversión o pasar el pago a la obra no es un cambio hecho por una persona
    if (new.amount, new.currency, new.exchange_rate, new.paid_on, new.concept, new.method, new.receipt, new.notes)
       is not distinct from
       (old.amount, old.currency, old.exchange_rate, old.paid_on, old.concept, old.method, old.receipt, old.notes) then
      return null;
    end if;
    perform public.log_activity('payment', new.id, new.project_id, 'updated',
      format('modificó un pago de %s en %s', public.format_money(new.amount, new.currency), place));
  else
    perform public.log_activity('payment', old.id, old.project_id, 'deleted',
      format('eliminó un pago de %s en %s', public.format_money(old.amount, old.currency), place));
  end if;
  return null;
end $$;
