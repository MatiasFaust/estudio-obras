# Obras · Estudio de Arquitectura (Paysandú)

Mapa interactivo de Paysandú con las obras del estudio y sus notas e ideas.

> **Sistema de gestión completo:** en la carpeta [`sistema/`](sistema/) está el nuevo sistema (Next.js + Supabase) con obras, clientes, mapa, notas y roles. Ver [sistema/README.md](sistema/README.md). Esta página simple sigue funcionando mientras tanto.

- Mapa con Leaflet y OpenStreetMap, centrado en Paysandú.
- Agregar, editar y eliminar obras (con confirmación), con padrón y cliente. La ubicación se marca con un clic en el mapa o con el botón **Buscar** a partir de la dirección.
- Notas e ideas por obra: se agregan y se eliminan, y quedan con fecha y autor.
- Listado lateral con buscador.
- Funciona en computadora y en celular.

No requiere instalar dependencias ni compilar: es HTML, CSS y JavaScript.

## Estructura

```
proyecto/
├── index.html          Página principal
├── css/styles.css      Estilos
├── js/config.js        Configuración (credenciales de Supabase, centro del mapa)
├── js/obras-iniciales.js  Obras que se cargan la primera vez (modo local; no se sube a GitHub)
├── js/store.js         Guardado de datos (Supabase o navegador)
├── js/app.js           Funcionamiento de la página
├── supabase/schema.sql         Tablas y permisos de la base de datos
└── supabase/obras-iniciales.sql  Obras iniciales para Supabase (no se sube a GitHub)
```

## 1. Probarla ya (modo local)

1. Abrí la carpeta `proyecto` en Visual Studio Code.
2. Instalá la extensión **Live Server** (de Ritwick Dey).
3. Clic derecho sobre `index.html` → **Open with Live Server**.

Sin configurar nada, la página funciona en **modo local**: las obras y notas se guardan en ese navegador y se mantienen al cerrarlo, pero no se comparten con otros dispositivos. Un aviso en el menú lateral lo indica.

> También se puede abrir `index.html` con doble clic. En ese caso el mapa base es el de Esri, porque OpenStreetMap bloquea las páginas abiertas como archivo local. Con Live Server o con la página publicada se usa OpenStreetMap.

## 2. Compartir los datos entre el equipo (Supabase, gratis)

1. Creá una cuenta en <https://supabase.com> y un proyecto nuevo (región sugerida: *South America (São Paulo)*).
2. En **SQL Editor → New query**, pegá el contenido de `supabase/schema.sql` y presioná **Run**. Después hacé lo mismo, una sola vez, con `supabase/obras-iniciales.sql` para cargar las obras iniciales del estudio.
3. En **Authentication → Sign In / Providers**, desactivá **Allow new users to sign up**. Así nadie de afuera puede crearse una cuenta.
4. En **Authentication → Users → Add user → Create new user**, creá una cuenta (correo + contraseña) por cada integrante del estudio y marcá **Auto Confirm User**.
5. En **Project Settings → API** copiá la **Project URL** y la clave **anon public**, y pegalas en `js/config.js`:

   ```js
   SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```

6. Recargá la página: va a pedir correo y contraseña.

Con Supabase configurado, todos ven la misma información, y los cambios de un integrante aparecen en las pantallas de los demás sin recargar.

**Seguridad:** la clave *anon* puede estar en el código. Los datos están protegidos por las políticas de la base de datos (`schema.sql`): solo los usuarios con sesión iniciada pueden leer o modificar obras y notas.

> Los datos guardados en modo local no se pasan a Supabase. Conviene configurar Supabase antes de empezar a cargar obras reales.

## 3. Publicarla en internet (opcional)

Para usarla desde el celular sin la computadora prendida, subí la carpeta a un hosting estático gratuito. Por ejemplo, en <https://app.netlify.com/drop> se arrastra la carpeta `proyecto` y se obtiene un enlace. El acceso sigue protegido con el usuario y la contraseña de Supabase.

## Uso

- **+ Agregar obra:** completá nombre y dirección, hacé clic en el mapa para marcar la ubicación (el marcador se puede arrastrar) y presioná **Guardar obra**.
- **Ver una obra:** tocá su marcador o elegila en el listado lateral.
- **Notas:** escribí en el panel de la obra y presioná **Guardar nota** (o Ctrl + Enter).
- **Editar / Eliminar:** botones en el panel de la obra. Al eliminar una obra se borran también sus notas.
