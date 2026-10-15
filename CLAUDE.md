# Contexto del proyecto (para continuar en cualquier computadora)

Sistema de gestión para el estudio de arquitectura **RF** de Paysandú, Uruguay. Lo usa el hermano del dueño de la cuenta (Matías). Matías no es programador: escribe en español rioplatense, con mensajes cortos. Explicale paso a paso, en español, sin jerga, y pedile capturas cuando tenga que tocar algo en Supabase o Vercel.

## Estructura del repositorio

| Carpeta | Qué es |
|---|---|
| `/` (raíz: `index.html`, `css/`, `js/`) | Primera versión: página simple con Leaflet, publicada en GitHub Pages (https://matiasfaust.github.io/estudio-obras/). Ya no se desarrolla. |
| `sistema/` | **El sistema actual**: Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui (variante Base UI) y Supabase. Ver `sistema/README.md` y `sistema/docs/ARQUITECTURA.md`. |

## Servicios (cuenta GitHub: MatiasFaust)

- **GitHub:** https://github.com/MatiasFaust/estudio-obras (público). Nunca subas datos de clientes.
- **Vercel:** proyecto `estudio-rf`, publicado en **https://estudio-rf.vercel.app**. Para publicar, desde `sistema/`: `npx vercel deploy --prod --yes`. La primera vez en una computadora nueva: `npx vercel login` y después `npx vercel link --yes --project estudio-rf`.
- **Supabase:** proyecto `estudio-rf`, URL `https://sqjnjueiebwongosroni.supabase.co`. En la misma organización hay otro proyecto, `rfm-alquileres`, que **no es de este sistema**: no lo toques.
  - La clave publishable va en `sistema/.env.local`, que no está en git. Para recuperarla: `npx vercel env pull .env.local` (después de `vercel link`).
  - Ojo: si cargás variables en Vercel desde PowerShell con `|`, se agrega un BOM invisible. Usá un archivo UTF-8 sin BOM y `cmd /c "... < archivo"`.
  - Las migraciones se ejecutan pegándolas en el SQL Editor de Supabase: Matías lo hace con el portapapeles. No hay contraseña de base ni CLI vinculada.
- **Usuarios:** dos cuentas, las dos con rol `admin`. Están en *Supabase → Authentication → Users*. No escribas correos en este archivo, porque el repositorio es público.

## Estado al 15-10-2026

- ✅ Etapa 1 completa y publicada: login, roles, panel, mapa, obras (etapas, avance, historial), clientes, notas e ideas.
- ✅ Módulo de pagos (monto acordado, pagos UYU/USD con cotización, saldo por cobrar, solo admin): el código está publicado.
- ⏳ **Pendiente en Supabase:** ejecutar `sistema/supabase/migrations/20261013000001_pagos.sql` en el SQL Editor. Para verificarlo: `curl "$URL/rest/v1/payments?select=id" -H "apikey: $KEY"` tiene que devolver `[]`, no `PGRST205`.
- ⏳ **Pendiente en Supabase:** desactivar *Authentication → Sign In / Providers → Allow new users to sign up* (`/auth/v1/settings` tiene que mostrar `disable_signup: true`). También configurar *URL Configuration*: Site URL `https://estudio-rf.vercel.app` y Redirect URL `https://estudio-rf.vercel.app/restablecer`.
- Las 3 obras reales del estudio ya están cargadas en Supabase. El SQL original está en `sistema/supabase/datos-reales/`, que está en `.gitignore` y existe solo en la PC de escritorio.

## Próximas etapas (ver `sistema/docs/ARQUITECTURA.md`)

- **Etapa 2:** tareas y Kanban, calendario, gestión de usuarios desde la app (requiere `service_role` del lado del servidor, nunca en el navegador), documentos y planos (Storage privado), visitas y fotos.
- **Etapa 3:** presupuestos en PDF, gastos, proveedores, informes y notificaciones.
- **Etapa 4:** producción y más pruebas.

## Notas técnicas que ya costaron tiempo

- Next.js 16: `middleware` ahora es `src/proxy.ts`. `cacheComponents` está activo, así que los componentes cliente que usan `usePathname`, `useParams` o `useSearchParams` tienen que estar dentro de `<Suspense>` (el layout `(app)` ya lo hace). Antes de usar APIs de Next, leé la documentación en `sistema/node_modules/next/dist/docs/`.
- shadcn usa **Base UI**, no Radix: se usa `render={<Button/>}` en lugar de `asChild`. `CommandDialog` no incluye `<Command>`, así que hay que envolverlo a mano. `Select` necesita la prop `items` para mostrar etiquetas. El paquete npm `cn` es oficial de shadcn.
- Seguridad: RLS + funciones `security definer` en las migraciones. `src/lib/permissions.ts` solo replica las reglas para la interfaz.
- Sin `.env.local`, la app corre en **modo demo** (datos ficticios en localStorage) con la misma interfaz `Repo` (`src/lib/data/`).
- Las fechas por defecto van en hora local (`date-fns format`), no con `toISOString()`: en Uruguay, después de las 21 horas, UTC ya es el día siguiente.

## Comprobaciones

Desde `sistema/`:
- `npm run check`: tipos, lint y pruebas de base de datos en PGlite.
- `npm run test:e2e`: pruebas en el navegador en modo demo. Antes hay que renombrar temporalmente `.env.local`, ejecutar `npm run build` y `npx next start -p 3100`, y correr la prueba con `BASE_URL=http://localhost:3100`. Usa Microsoft Edge.

Antes de publicar, corré las dos.
