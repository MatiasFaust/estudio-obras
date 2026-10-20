-- =============================================================================
-- Presupuesto aceptado → monto acordado de la obra.
-- Cuando un presupuesto se marca como "aceptado" (o cambia el precio de uno aceptado),
-- su precio pasa a ser lo que el cliente tiene que pagar, y el avance de pagos de la
-- obra se calcula contra ese monto.
-- =============================================================================

create or replace function public.budgets_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'aceptado' and new.price is not null then
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

create trigger budgets_accept after insert or update of status, price, currency, number on public.budgets
  for each row execute function public.budgets_accept();
