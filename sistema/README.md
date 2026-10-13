# Estudio · Sistema de gestión

Sistema web para administrar un estudio de arquitectura en Paysandú, Uruguay: obras, clientes, mapa, notas e ideas.

- **Tecnología:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Leaflet + OpenStreetMap, Supabase (PostgreSQL, Auth, Realtime).
- **Arquitectura:** ver [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).
- **Copias de seguridad:** ver [docs/RESPALDOS.md](docs/RESPALDOS.md).

## Estado del desarrollo

| Etapa | Contenido | Estado |
|---|---|---|
| 1 · Sistema principal | Inicio de sesión y recuperación de contraseña, roles, panel, mapa de obras, gestión de obras (estados, etapas, avance, archivo, historial), clientes, notas e "Ideas del estudio" | ✅ Implementada y probada |
| 2 · Organización | Tareas y Kanban, calendario, gestión de usuarios desde el sistema, documentos y planos, visitas, fotografías | ⏳ Pendiente |
| 3 · Gestión empresarial | Presupuestos (PDF), gastos y cobros, proveedores, informes, notificaciones | ⏳ Pendiente |
| 4 · Producción | Optimización, más pruebas automatizadas, puesta en producción | ⏳ Pendiente |

Lo que el sistema todavía **no** tiene (llega en las etapas siguientes): fotografías y archivos adjuntos, tareas, agenda, presupuestos y finanzas, notificaciones, y el alta de usuarios desde la propia aplicación. Por ahora los usuarios se crean en Supabase.

---

## 1. Requisitos

- [Node.js](https://nodejs.org) 20.9 o superior (LTS recomendado).
- [Visual Studio Code](https://code.visualstudio.com).
- Una cuenta gratuita en [Supabase](https://supabase.com), solo para usar datos reales.

## 2. Instalación

En VS Code, abrí la carpeta `sistema` y después una terminal (menú *Terminal → New Terminal*):

```bash
npm install
```

## 3. Probar sin configurar nada (modo demostración)

```bash
npm run dev
```

Abrí <http://localhost:3000>. Sin credenciales de Supabase, el sistema arranca en **modo demostración**:

- Se ingresa eligiendo un usuario ficticio: administradora, arquitecto o colaboradora. Así se ve cómo cambian los permisos según el rol.
- Los datos son **ficticios** y se guardan solo en ese navegador. Una franja amarilla lo indica en todas las pantallas.
- Desde el menú del perfil se puede usar *Reiniciar datos de demo*.

## 4. Configurar Supabase (datos reales y compartidos)

### 4.1 Crear el proyecto
1. Entrá a <https://supabase.com>, creá un proyecto (región sugerida: *South America (São Paulo)*) y guardá la contraseña de la base de datos.

### 4.2 Crear la base de datos
2. En *SQL Editor → New query*, pegá **todo** el contenido de `supabase/migrations/20261012000001_etapa1.sql` y presioná **Run**.
3. Opcional, para probar: ejecutá también `supabase/seed.sql`, que carga datos ficticios marcados con "(DEMO)".
4. Para cargar las obras reales del estudio, ejecutá `supabase/datos-reales/obras-iniciales.sql`. Ese archivo existe solo en la computadora del estudio y no se sube a GitHub.

### 4.3 Seguridad de acceso
5. En *Authentication → Sign In / Providers → Email*, **desactivá "Allow new users to sign up"**. Así solo entran las cuentas que crea el estudio.
6. En *Authentication → URL Configuration*:
   - **Site URL:** `http://localhost:3000`, o la dirección pública cuando el sistema esté publicado.
   - **Redirect URLs:** agregá `http://localhost:3000/restablecer` y, si corresponde, `https://tu-dominio/restablecer`. Es necesario para la recuperación de contraseña.

### 4.4 Crear los usuarios
7. En *Authentication → Users → Add user → Create new user*, creá una cuenta por integrante (correo y contraseña) y marcá **Auto Confirm User**.
8. Todos empiezan como **colaborador**. Para asignar roles, en el *SQL Editor*:

   ```sql
   update public.profiles set role = 'admin', full_name = 'Nombre Apellido' where email = 'admin@estudio.uy';
   update public.profiles set role = 'arquitecto', full_name = 'Nombre Apellido' where email = 'arquitecto@estudio.uy';
   ```

   Roles posibles: `admin`, `arquitecto` y `colaborador`. Para desactivar a alguien: `update public.profiles set active = false where email = '...';`

### 4.5 Conectar el sistema
9. En *Project Settings → API* copiá la **Project URL** y la clave **anon public**.
10. Copiá `.env.example` como `.env.local` y completá esos dos valores.
11. Reiniciá `npm run dev`. Ahora el sistema pide correo y contraseña.

> La clave `anon` es pública por diseño. La seguridad la aplican las políticas de la base de datos (Row Level Security): cada consulta se filtra según el usuario y su rol. **Nunca** pongas la clave `service_role` en el proyecto.

## 5. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (<http://localhost:3000>) |
| `npm run build` y luego `npm start` | Compilación y servidor de producción |
| `npm run check` | Comprobación de tipos, lint y pruebas de la base de datos |
| `npm run test:db` | 38 pruebas de la base de datos (tablas, permisos por rol, historial, validaciones) en un PostgreSQL embebido |
| `npm run test:e2e` | Prueba de punta a punta en el navegador (modo demo). Requiere el servidor encendido y Microsoft Edge, o la variable `BROWSER_PATH` |

## 6. Publicar en internet

El sistema necesita un servidor Node.js, por la protección de rutas con `proxy.ts`. **No** funciona en GitHub Pages. La opción más simple es **Vercel**, que es gratis para uso inicial:

1. Subí el repositorio a GitHub.
2. En <https://vercel.com>, elegí *Add New → Project*, seleccioná el repositorio y poné como *Root Directory* la carpeta `sistema`.
3. Cargá las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Agregá la dirección pública en las *Redirect URLs* de Supabase (paso 4.3).

## 7. Funciones de la Etapa 1

- **Acceso:** inicio de sesión, recuperación de contraseña por correo, cierre de sesión, rutas privadas protegidas y usuarios desactivables.
- **Roles:** administrador, arquitecto y colaborador. Los permisos se aplican en la base de datos; ocultar botones es solo ayuda visual.
- **Panel:** obras por estado, notas pendientes, clientes, obras en construcción con su avance, distribución por estado y tipo, próximos vencimientos y actividad reciente.
- **Mapa:** centrado en Paysandú, con colores por estado (activa, planificación, pausada, finalizada), filtros, búsqueda y ficha en cada marcador. Abre la ubicación en Google Maps y permite agregar una obra tocando el mapa. Muestra todo Uruguay.
- **Obras:**
  - Código automático `OB-AAAA-NNN`, cliente, tipo, responsable, fechas, padrón y ubicación.
  - Ubicación por padrón (Catastro) o por dirección.
  - Ocho estados, archivado y restauración, y eliminación solo por un administrador.
  - Etapas con peso y avance ponderado (o avance manual autorizado), colaboradores asignados e historial de cambios.
- **Clientes:** personas o empresas, con validación de cédula y RUT uruguayos, contacto, observaciones internas, obras asociadas, archivado, y protección para no borrar clientes con obras.
- **Notas e ideas:** en cada obra y en "Ideas del estudio". Tienen editor con formato básico, categoría (idea, observación, pendiente, importante), autor y fecha, y se pueden buscar, filtrar, editar, resolver y eliminar.
- **Buscador global** (Ctrl + K): encuentra obras, clientes y notas, respetando los permisos.
- **Tiempo real:** los cambios de un integrante aparecen en las pantallas de los demás.
- **Tema claro y oscuro**, y diseño adaptado a computadora, tablet y celular.
