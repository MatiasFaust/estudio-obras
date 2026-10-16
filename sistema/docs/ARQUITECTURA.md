# Arquitectura del sistema

Sistema de gestión para un estudio de arquitectura de Paysandú, Uruguay.

## 1. Visión general

```
┌────────────────────────────── Navegador (computadora / celular) ──────────────────────────────┐
│  Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · shadcn/ui (Base UI) · Lucide  │
│                                                                                              │
│  Páginas  ──►  hooks de datos (TanStack Query)  ──►  Repositorio (interfaz única)            │
│                                                      ├─ SupabaseRepo  (producción)           │
│                                                      └─ DemoRepo      (sin credenciales)     │
└───────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                            │ HTTPS (clave pública "anon" + JWT del usuario)
┌───────────────────────────────────────────▼──────────────────────────────────────────────────┐
│ Supabase                                                                                     │
│  Auth (sesiones, recuperación de contraseña)                                                 │
│  PostgreSQL: tablas + Row Level Security + triggers (código de obra, avance, historial)      │
│  Realtime: cambios en vivo entre integrantes                                                 │
│  Storage privado (Etapa 2: documentos, planos, fotos)                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Decisiones principales**

| Decisión | Motivo |
|---|---|
| La seguridad vive en PostgreSQL (RLS + funciones `security definer`) | Los permisos se aplican aunque alguien manipule el navegador. Ocultar botones es solo una ayuda visual. |
| Historial de actividad generado por *triggers* | Registra quién hizo cada cambio sin depender del frontend. |
| Código de obra, avance y validaciones en la base | Una única fuente de verdad, consistente para todos los usuarios. |
| `proxy.ts` (antes "middleware") protege las rutas privadas | Next.js 16 renombró `middleware` a `proxy`. Redirige al login si no hay sesión. |
| Repositorio con dos implementaciones | Permite una demo local completa sin credenciales, con el mismo código de pantallas. |
| TanStack Query + Supabase Realtime | Caché en el cliente, e invalidación automática cuando otro integrante cambia algo. |
| Sin claves privadas en el navegador | Solo se usa la clave pública (`anon`). La `service_role` queda para tareas de servidor (Etapa 2, alta de usuarios). |

## 2. Roles y permisos

| Acción | Administrador | Arquitecto | Colaborador |
|---|:-:|:-:|:-:|
| Ver obras | Todas | Todas | Solo las asignadas |
| Crear, editar, cambiar estado y archivar obras | ✔ | ✔ | — |
| Eliminar obras y clientes definitivamente | ✔ | — | — |
| Ver clientes | Todos | Todos | Solo los de sus obras |
| Crear y editar clientes | ✔ | ✔ | — |
| Etapas y avance manual | ✔ | ✔ | — |
| Notas en obras accesibles e "Ideas del estudio" | ✔ | ✔ | ✔ |
| Editar o borrar notas ajenas | ✔ | ✔ | Solo las propias |
| Cambiar roles de usuarios | ✔ | — | — |
| Información financiera (Etapa 3) | ✔ | — | — |

Las reglas están en `supabase/migrations/*.sql` (políticas RLS). Para la interfaz se repiten en `src/lib/permissions.ts`.

## 3. Modelo de datos

Implementado en la **Etapa 1**:

- `profiles`: integrantes, con su rol y si están activos (1:1 con `auth.users`).
- `clients`: personas o empresas, con cédula o RUT, contacto y observaciones internas.
- `projects`: obras y proyectos, con código único `OB-AAAA-NNN`, ubicación, padrón, estado y avance.
- `project_members`: qué colaboradores pueden ver cada obra.
- `project_stages`: etapas o hitos con peso y avance. El avance de la obra es el promedio ponderado, salvo que se fije a mano.
- `notes`: notas de obra, o "Ideas del estudio" cuando `project_id` es nulo. Texto con formato (JSON de Tiptap), categoría y estado "resuelta".
- `activity_log`: historial de cambios, escrito solo por *triggers*.

**Estudio de desarrollo** (casas y terrenos propios en alquiler, migración `20261016000001_desarrollo.sql`):

- `profiles.arquitectura` (booleano) y `profiles.desarrollo` (`admin`, `colaborador` o nulo): a qué estudio entra cada usuario. Sin `arquitectura`, el rol de siempre no cuenta (`current_user_role()` devuelve nulo).
- `dev_properties`: casas y terrenos, con estado `alquilada`, `desocupada`, `en_construccion`, `terreno_baldio` o `alquiler_por_dia`. Las ve todo el equipo de desarrollo; solo el administrador las cambia.
- `dev_tenants`, `dev_leases` (contratos) y `dev_rent_payments` (cobros por mes, en la moneda del contrato): solo administradores de desarrollo.
- Un *trigger* impide contratos superpuestos en la misma casa y pasa la casa a "alquilada" o "desocupada" según haya un contrato vigente.
- Lo que se adeuda no se guarda: se calcula en `src/lib/dev.ts` (meses vencidos del contrato menos lo cobrado en cada mes).
- Las pantallas viven en `/desarrollo/*`. Los botones de arriba (`AreaSwitch`) solo aparecen si el usuario tiene acceso a los dos estudios, y `AppShell` redirige a quien entra a un área que no le corresponde.
- El proyecto de Supabase `rfm-alquileres` (reservas de la página pública de RFM) es independiente y no se toca.

Planificado (cada etapa agrega su migración):

| Etapa | Tablas |
|---|---|
| 2 | `tasks`, `task_comments`, `events`, `event_attendees`, `documents`, `document_versions`, `folders`, `visits`, `visit_photos` |
| 3 | `suppliers`, `project_suppliers`, `budgets`, `budget_items`, `expenses`, `payments`, `notifications` |
| 4 | Índices adicionales, vistas para informes y rutinas de respaldo |

## 4. Estructura de carpetas

```
sistema/
├── docs/                      Arquitectura y operación (respaldos)
├── supabase/
│   ├── migrations/            SQL reproducible, en orden
│   └── seed.sql               Datos ficticios para pruebas
└── src/
    ├── app/
    │   ├── (auth)/            login, recuperar, restablecer
    │   └── (app)/             pantallas privadas (dashboard, mapa, obras, clientes, ideas)
    ├── components/
    │   ├── ui/                shadcn/ui
    │   ├── layout/            menú lateral, barra superior, buscador global
    │   ├── map/               mapa de obras y selector de ubicación (Leaflet)
    │   ├── projects/ clients/ notes/ dashboard/ common/
    ├── lib/
    │   ├── data/              repositorio (Supabase y demo), proveedor y hooks
    │   ├── supabase/          clientes de Supabase
    │   ├── constants.ts       estados, tipos, categorías y colores
    │   ├── permissions.ts     reglas de rol para la interfaz
    │   ├── validation.ts      esquemas zod (y validación de cédula uruguaya)
    │   └── types.ts
    └── proxy.ts               protección de rutas y refresco de sesión
```

## 5. Etapas

| Etapa | Contenido | Estado |
|---|---|---|
| 1 | Estructura, login y recuperación de contraseña, base de datos, dashboard, mapa, obras, clientes, notas e ideas | Implementada |
| 2 | Tareas (lista y Kanban), calendario, usuarios y permisos, documentos y planos, visitas, fotos | Pendiente |
| 3 | Presupuestos (PDF), gastos y cobros, proveedores, informes, notificaciones | Pendiente |
| 4 | Seguridad, optimización, pruebas automatizadas, preparación para producción | Pendiente |
