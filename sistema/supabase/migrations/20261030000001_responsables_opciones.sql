-- =============================================================================
-- Presupuestos: personas que se ofrecen como responsables (botones para elegirlas).
-- Se cargan en Plantilla → Responsables, una por línea.
-- =============================================================================

alter table public.budget_settings
  add column responsibles jsonb not null default '[]' check (jsonb_typeof(responsibles) = 'array');
