-- =============================================================================
-- Expedientes (trámites en la Intendencia): se arman desde un presupuesto, que completa
-- número, padrón, cliente y servicio, o se cargan a mano. El estado tiene dos partes:
-- en qué oficina está y qué tarea falta.
-- Solo agrega una tabla nueva: no cambia nada de lo que ya está cargado.
-- =============================================================================

create table public.permit_files (
  id             uuid primary key default gen_random_uuid(),
  -- Presupuesto del que salió (si se borra el presupuesto, el expediente queda)
  budget_id      uuid references public.budgets (id) on delete set null,
  budget_number  text not null default '' check (char_length(budget_number) <= 30),
  padron         text not null default '' check (char_length(padron) <= 30),
  client_name    text not null default '' check (char_length(client_name) <= 160),
  service        text not null default '' check (char_length(service) <= 160),
  -- Número de expediente de la Intendencia, ej.: 21/0224/2026
  file_number    text not null default '' check (char_length(file_number) <= 40),
  office         text check (office in ('edificaciones', 'planeamiento_urbano')),
  task           text check (task in ('grafico_veraz', 'levantar_observaciones', 'inspeccion_final')),
  notes          text not null default '' check (char_length(notes) <= 1000),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index permit_files_budget_idx on public.permit_files (budget_id);

create trigger permit_files_updated_at before update on public.permit_files
  for each row execute function public.set_updated_at();

-- Como los presupuestos: solo administradores
alter table public.permit_files enable row level security;
create policy permit_files_admin on public.permit_files for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

alter publication supabase_realtime add table public.permit_files;
