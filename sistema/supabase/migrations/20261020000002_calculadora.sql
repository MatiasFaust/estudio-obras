-- =============================================================================
-- Calculadora de presupuestos: valores que usa, guardados en la plantilla del estudio.
-- Todo en pesos uruguayos. Se cargan desde Presupuestos → Plantilla → Calculadora.
-- =============================================================================

alter table public.budget_settings
  -- Tipos de trabajo: [{ "name": "Reforma", "fee_per_m2": 1200, "wages_per_m2": 1.5, "build_cost_per_m2": 40000 }]
  add column calc_types      jsonb not null default '[]' check (jsonb_typeof(calc_types) = 'array'),
  -- Valor de un jornal (para el estimado de jornales)
  add column wage_value      numeric(14, 2) check (wage_value >= 0),
  -- Gastos (copias, timbres, derechos, tributos): un monto fijo más un monto por m²
  add column expenses_fixed  numeric(14, 2) check (expenses_fixed >= 0),
  add column expenses_per_m2 numeric(14, 2) check (expenses_per_m2 >= 0),
  add column iva_rate        numeric(5, 2) not null default 22 check (iva_rate between 0 and 100);
