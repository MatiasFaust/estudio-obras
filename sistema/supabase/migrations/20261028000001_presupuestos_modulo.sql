-- =============================================================================
-- Presupuestos como módulo propio:
--  - Dos tipos: con hoja membretada (PDF formal) o manual con costo fijo (sin PDF).
--  - La obra pasa a ser opcional: el presupuesto guarda su cliente, padrón, dirección y servicio.
--  - Estados: pendiente, enviado, aceptado, en ejecución, finalizado y rechazado.
-- =============================================================================

-- Obra opcional: si se borra la obra, el presupuesto queda (sin obra)
alter table public.budgets alter column project_id drop not null;
alter table public.budgets drop constraint budgets_project_id_fkey;
alter table public.budgets add constraint budgets_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

alter table public.budgets
  add column kind        text not null default 'membretado' check (kind in ('membretado', 'manual')),
  add column client_name text not null default '' check (char_length(client_name) <= 160),
  add column padron      text not null default '' check (char_length(padron) <= 30),
  add column address     text not null default '' check (char_length(address) <= 200),
  add column service     text not null default '' check (char_length(service) <= 160);

-- Estados nuevos ("borrador" pasa a "pendiente")
alter table public.budgets drop constraint budgets_status_check;
update public.budgets set status = 'pendiente' where status = 'borrador';
alter table public.budgets alter column status set default 'pendiente';
alter table public.budgets add constraint budgets_status_check
  check (status in ('pendiente', 'enviado', 'aceptado', 'en_ejecucion', 'finalizado', 'rechazado'));

-- Los presupuestos que ya existen toman cliente, padrón y dirección de su obra
update public.budgets b
set client_name = coalesce(c.name, ''), padron = coalesce(p.padron, ''), address = coalesce(p.address, '')
from public.projects p
left join public.clients c on c.id = p.client_id
where p.id = b.project_id and b.client_name = '';

-- Aceptado (o ya en ejecución o finalizado) → su precio pasa a ser el monto acordado de la obra vinculada
create or replace function public.budgets_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.project_id is not null and new.price is not null
     and new.status in ('aceptado', 'en_ejecucion', 'finalizado') then
    insert into public.project_finances (project_id, agreed_amount, currency, notes)
    values (
      new.project_id, new.price, new.currency,
      case when new.number <> '' then format('Según el presupuesto %s, aceptado.', new.number)
           else 'Según el presupuesto aceptado.' end
    )
    on conflict (project_id) do update
      set agreed_amount = excluded.agreed_amount,
          currency = excluded.currency,
          notes = excluded.notes;
  end if;
  return null;
end $$;

drop trigger budgets_accept on public.budgets;
create trigger budgets_accept after insert or update of status, price, currency, number, project_id on public.budgets
  for each row execute function public.budgets_accept();

-- Historial: también para presupuestos sin obra
create or replace function public.log_budgets()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec public.budgets;
  place text;
  label text;
begin
  rec := coalesce(new, old);
  select format('%s · %s', code, name) into place from public.projects where id = rec.project_id;
  place := coalesce(place, nullif(rec.client_name, ''), 'sin obra');
  label := case when rec.number <> '' then format('el presupuesto %s', rec.number) else 'un presupuesto' end;
  if tg_op = 'INSERT' then
    perform public.log_activity('payment', new.id, new.project_id, 'created', format('creó %s (%s)', label, place));
  elsif tg_op = 'DELETE' then
    perform public.log_activity('payment', old.id, old.project_id, 'deleted', format('eliminó %s (%s)', label, place));
  elsif new.status is distinct from old.status then
    perform public.log_activity('payment', new.id, new.project_id, 'updated',
      format('cambió %s (%s) a %s', label, place, replace(new.status, '_', ' ')));
  end if;
  return null;
end $$;
