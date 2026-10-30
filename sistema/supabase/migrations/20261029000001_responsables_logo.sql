-- =============================================================================
-- Presupuestos: responsables de cada presupuesto y logo principal de la hoja membretada.
--  - responsible: quién se encarga (texto libre, ej.: "Roni y Jimena").
--  - logo: imagen del logo de arriba a la izquierda del PDF (data URL). Si no hay,
--    se dibuja el cuadrado negro con "RF.".
-- =============================================================================

alter table public.budgets
  add column responsible text not null default '' check (char_length(responsible) <= 160);

alter table public.budget_settings
  add column logo text check (logo is null or char_length(logo) < 2000000);
