-- =============================================================================
-- DATOS FICTICIOS para probar el sistema en Supabase.
-- Todos los registros llevan "(DEMO)" en el nombre para distinguirlos de los reales.
-- Ejecutar en el SQL Editor DESPUÉS de la migración. Es opcional.
--
-- Para borrarlos más adelante:
--   delete from public.projects where name like '%(DEMO)%';
--   delete from public.clients  where name like '%(DEMO)%';
--   delete from public.notes    where title like '%(DEMO)%';
-- =============================================================================

with c as (
  insert into public.clients (kind, name, document, phone, email, address, notes) values
    ('persona', 'Familia Ejemplo Acosta (DEMO)', '1.234.567-2', '099 000 001', 'acosta@ejemplo.uy', 'Calle Ficticia 100, Paysandú', 'Prefieren reuniones los sábados.'),
    ('empresa', 'Constructora Demo S.A. (DEMO)', '211234560019', '4722 0000', 'contacto@constructora-demo.uy', 'Av. Imaginaria 2000, Paysandú', null),
    ('persona', 'Martina Prueba Silva (DEMO)', null, '098 000 002', 'martina@ejemplo.uy', null, null)
  returning id, name
),
p as (
  insert into public.projects (name, client_id, address, locality, lat, lng, project_type, status, start_date, due_date, description)
  select v.name, c.id, v.address, v.locality, v.lat, v.lng, v.ptype, v.status::public.project_status,
         current_date + v.start_off, current_date + v.due_off, v.description
  from (values
    ('Vivienda Acosta (DEMO)', 'Familia Ejemplo Acosta (DEMO)', 'Calle Ficticia 100', 'Paysandú', -32.3215, -58.0790, 'vivienda', 'en_construccion', -90, 45, 'Vivienda de dos plantas con patio interior.'),
    ('Edificio Mirador (DEMO)', 'Constructora Demo S.A. (DEMO)', 'Av. Imaginaria 2000', 'Paysandú', -32.3135, -58.0905, 'edificio', 'proyecto_ejecutivo', 30, 540, 'Edificio de 6 niveles.'),
    ('Reforma Casa Silva (DEMO)', 'Martina Prueba Silva (DEMO)', 'Pasaje Ejemplo 45', 'Paysandú', -32.3262, -58.0712, 'reforma', 'en_construccion', -40, 12, 'Reforma de cocina y baños.'),
    ('Casa de campo (DEMO)', 'Martina Prueba Silva (DEMO)', 'Ruta ficticia km 3', 'Guichón', -32.3528, -57.1995, 'vivienda', 'anteproyecto', 60, 400, null)
  ) as v(name, client, address, locality, lat, lng, ptype, status, start_off, due_off, description)
  join c on c.name = v.client
  returning id, name
),
s as (
  insert into public.project_stages (project_id, name, position, weight, progress)
  select p.id, v.stage, v.pos, v.weight, v.progress
  from (values
    ('Vivienda Acosta (DEMO)', 'Cimentación', 0, 15, 100),
    ('Vivienda Acosta (DEMO)', 'Estructura y muros', 1, 30, 100),
    ('Vivienda Acosta (DEMO)', 'Cubierta', 2, 15, 80),
    ('Vivienda Acosta (DEMO)', 'Instalaciones', 3, 20, 40),
    ('Vivienda Acosta (DEMO)', 'Terminaciones', 4, 20, 0),
    ('Reforma Casa Silva (DEMO)', 'Demolición', 0, 10, 100),
    ('Reforma Casa Silva (DEMO)', 'Instalación sanitaria', 1, 40, 90),
    ('Reforma Casa Silva (DEMO)', 'Revestimientos', 2, 50, 30)
  ) as v(project, stage, pos, weight, progress)
  join p on p.name = v.project
  returning 1
)
insert into public.notes (project_id, title, content, content_text, category)
select p.id, v.title,
       jsonb_build_object('type', 'doc', 'content', jsonb_build_array(
         jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(
           jsonb_build_object('type', 'text', 'text', v.body))))),
       v.body, v.category::public.note_category
from (values
  ('Vivienda Acosta (DEMO)', 'Ventana del dormitorio (DEMO)', 'Cambiar la ubicación de la ventana del dormitorio principal.', 'pendiente'),
  ('Vivienda Acosta (DEMO)', 'Revestimiento exterior (DEMO)', 'Consultar con el cliente sobre el revestimiento exterior.', 'importante'),
  ('Reforma Casa Silva (DEMO)', 'Medidas del baño (DEMO)', 'Revisar las medidas antes de pedir sanitarios.', 'observacion')
) as v(project, title, body, category)
join p on p.name = v.project;

insert into public.notes (project_id, title, content, content_text, category)
values (null, 'Plantilla de memorias (DEMO)',
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Armar una plantilla única de memoria descriptiva."}]}]}',
        'Armar una plantilla única de memoria descriptiva.', 'idea');
