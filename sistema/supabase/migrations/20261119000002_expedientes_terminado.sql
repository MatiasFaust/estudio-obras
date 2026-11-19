-- =============================================================================
-- Expedientes: "Terminado" como última tarea. En la lista de Julia los terminados
-- (archivados) van en rojo y los que están en inspección final, en amarillo.
-- Solo suma una opción: no cambia nada de lo que ya está cargado.
-- =============================================================================

alter table public.permit_files drop constraint permit_files_task_check;
alter table public.permit_files add constraint permit_files_task_check
  check (task in ('grafico_veraz', 'levantar_observaciones', 'inspeccion_final', 'terminado'));
