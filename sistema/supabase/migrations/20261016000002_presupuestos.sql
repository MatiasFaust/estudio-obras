-- =============================================================================
-- Presupuestos en PDF: cada presupuesto queda guardado en su obra y se descarga
-- en PDF con la plantilla del estudio (textos fijos, firmas y pie).
-- Información comercial: solo administradores (RLS), igual que los pagos.
-- =============================================================================

-- Plantilla del estudio: una sola fila. Las firmas y logos se guardan como imágenes
-- (data URL) acá, en la base privada: nunca en el repositorio, que es público.
create table public.budget_settings (
  id                 boolean primary key default true check (id),
  studio_name        text not null default 'RF. estudio' check (char_length(studio_name) <= 80),
  tagline            text not null default '' check (char_length(tagline) <= 120),
  address            text not null default '' check (char_length(address) <= 160),
  greeting           text not null default 'De mi mayor consideración:' check (char_length(greeting) <= 200),
  intro              text not null default '' check (char_length(intro) <= 1000),
  closing            text not null default 'Saluda a Ud muy atte:' check (char_length(closing) <= 200),
  -- Valores que se copian a cada presupuesto nuevo
  payment_terms      jsonb not null default '[]',   -- [{ "label": "al comenzar los trabajos", "percent": 35 }]
  includes           jsonb not null default '[]',   -- ["3 imágenes (1 exterior y 2 interiores)", ...]
  excludes           text not null default '' check (char_length(excludes) <= 500),
  expenses_text      text not null default '' check (char_length(expenses_text) <= 500),
  note               text not null default '' check (char_length(note) <= 1000),
  -- Firmas: [{ "name": "...", "title": "...", "image": "data:image/png;base64,..." }]
  signers            jsonb not null default '[]',
  -- Pie: { "lines": ["@rf.estudioarq", ...], "partners": [{ "name": "...", "lines": [...], "logo": "data:..." }] }
  footer             jsonb not null default '{"lines": [], "partners": []}',
  updated_at         timestamptz not null default now(),
  check (pg_column_size(signers) + pg_column_size(footer) < 3000000)
);

insert into public.budget_settings (id) values (true);

create table public.budgets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects (id) on delete cascade,
  number           text not null default '' check (char_length(number) <= 30),
  issued_on        date not null default current_date,
  recipient        text not null default '' check (char_length(recipient) <= 160),
  -- Párrafo de presentación, ya completo y editable
  intro            text not null default '' check (char_length(intro) <= 2000),
  price            numeric(14, 2) check (price >= 0),
  currency         text not null default 'UYU' check (currency in ('UYU', 'USD')),
  iva_mode         text not null default 'mas_iva' check (iva_mode in ('mas_iva', 'iva_incluido', 'sin_iva')),
  payment_terms    jsonb not null default '[]',
  includes         jsonb not null default '[]',
  excludes         text not null default '' check (char_length(excludes) <= 500),
  expenses_text    text not null default '' check (char_length(expenses_text) <= 500),
  expenses_amount  numeric(14, 2) check (expenses_amount >= 0),
  wages_days       numeric(8, 1) check (wages_days >= 0),
  wages_amount     numeric(14, 2) check (wages_amount >= 0),
  note             text not null default '' check (char_length(note) <= 1000),
  status           text not null default 'borrador' check (status in ('borrador', 'enviado', 'aceptado', 'rechazado')),
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (jsonb_typeof(payment_terms) = 'array' and jsonb_typeof(includes) = 'array')
);

create index budgets_project_idx on public.budgets (project_id, issued_on desc);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();
create trigger budget_settings_updated_at before update on public.budget_settings
  for each row execute function public.set_updated_at();

-- Historial (visible solo para administradores: entity_type 'payment')
create or replace function public.log_budgets()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec public.budgets;
  pname text;
  label text;
begin
  rec := coalesce(new, old);
  select format('%s · %s', code, name) into pname from public.projects where id = rec.project_id;
  if pname is null then return null; end if;
  label := case when rec.number <> '' then format('el presupuesto %s', rec.number) else 'un presupuesto' end;
  if tg_op = 'INSERT' then
    perform public.log_activity('payment', new.id, new.project_id, 'created', format('creó %s en %s', label, pname));
  elsif tg_op = 'DELETE' then
    perform public.log_activity('payment', old.id, old.project_id, 'deleted', format('eliminó %s de %s', label, pname));
  elsif new.status is distinct from old.status then
    perform public.log_activity('payment', new.id, new.project_id, 'updated',
      format('marcó %s de %s como %s', label, pname, new.status));
  end if;
  return null;
end $$;

create trigger budgets_log after insert or update or delete on public.budgets
  for each row execute function public.log_budgets();

-- Row Level Security: solo administradores
alter table public.budget_settings enable row level security;
alter table public.budgets enable row level security;

create policy budget_settings_select on public.budget_settings for select to authenticated using (public.is_admin());
create policy budget_settings_update on public.budget_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy budgets_admin on public.budgets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.budgets, public.budget_settings;
