# Copias de seguridad y restauración

## Qué respaldar

| Qué | Dónde está | Cómo se respalda |
|---|---|---|
| Base de datos (obras, clientes, notas, historial, usuarios) | Supabase / PostgreSQL | Respaldos automáticos de Supabase y exportación manual con `pg_dump` |
| Código del sistema | Repositorio git | `git push` a GitHub |
| Archivos y planos (Etapa 2) | Supabase Storage | Descarga periódica del bucket |

## 1. Respaldos automáticos de Supabase

- **Plan gratuito:** Supabase no garantiza copias restaurables. Hay que hacer la exportación manual del punto 2 **al menos una vez por semana**.
- **Plan Pro:** incluye respaldos diarios (7 días). Se ven y se restauran en *Database → Backups*. Con el complemento *Point in Time Recovery* se puede volver a un minuto exacto.

## 2. Exportación manual (recomendada semanalmente)

Requisito: tener instalado PostgreSQL client (`pg_dump`) o la CLI de Supabase.

1. En Supabase, abrí *Project Settings → Database → Connection string → URI* y copiá la cadena. Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base.
2. En una terminal, ejecutá:

   ```bash
   pg_dump "postgresql://postgres:CONTRASEÑA@db.xxxx.supabase.co:5432/postgres" \
     --schema=public --data-only --no-owner --file=respaldo-AAAA-MM-DD.sql
   ```

3. Guardá el archivo en un lugar seguro y **fuera del repositorio**, por ejemplo una unidad externa o una nube privada del estudio. Contiene datos personales de clientes.

> Las cuentas de usuario están en el esquema `auth`, que administra Supabase. Si hubiera que recrear el proyecto, los integrantes se vuelven a crear desde *Authentication → Users* con el mismo correo. Después se reasignan los roles.

## 3. Restauración

**En el mismo proyecto** (por ejemplo, si se borraron datos por error):
- Con plan Pro: *Database → Backups → Restore*.
- Con plan gratuito: restaurar las tablas afectadas desde el último `respaldo-*.sql`, ejecutándolo en el SQL Editor o con `psql`.

**En un proyecto nuevo:**
1. Crear el proyecto en Supabase.
2. Ejecutar en orden los archivos de `supabase/migrations/`.
3. Crear los usuarios en *Authentication → Users* con los mismos correos.
4. Restaurar los datos con `psql "CADENA_DE_CONEXIÓN" -f respaldo-AAAA-MM-DD.sql`.
5. Actualizar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` (y en el hosting).

## 4. Prueba de restauración

Una vez por trimestre, restaurá el último respaldo en un proyecto de prueba de Supabase y verificá que se vean las obras. Un respaldo que nunca se probó no es confiable.
