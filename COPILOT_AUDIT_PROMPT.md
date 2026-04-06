# PROYECTO GIGI — Copilot Audit & Implementation Prompt

## Contexto del proyecto

Proyecto Gigi es una aplicación fullstack educativa para niños con baja visión (2–6 años).
Stack: Node.js 20 + Express 5 + Prisma 7 + PostgreSQL + Redis (backend) / React 19 + Vite 8 + Tailwind CSS 4 + React Router 7 + Zustand 5 (frontend).

Tu tarea es **auditar el código existente y, para cada funcionalidad listada a continuación, verificar si está implementada correctamente. Si no lo está, impleméntala o corrígela**.

---

## PARTE 1 — BACKEND (`server/`)

### 1.1 Autenticación y seguridad

Verifica y/o implementa en `src/routes/auth.js` y `src/middleware/auth.js`:

- [ ] `POST /api/auth/login` — devuelve `access_token` (JWT 15 min) + `refresh_token` (JWT 7d) + `user` + `preferences`
- [ ] `POST /api/auth/refresh` — renueva el access token usando el refresh token almacenado en BD. Verifica que el token no esté revocado en la tabla `RefreshToken`.
- [ ] `POST /api/auth/logout` — añade el access token a la blacklist de Redis con TTL de 15 min. Revoca el refresh token en BD (`revokedAt`).
- [ ] `POST /api/auth/change-password` — verifica contraseña actual con `bcryptjs.compare`, actualiza hash.
- [ ] Middleware `authenticateJWT` — verifica firma JWT, comprueba blacklist en Redis, adjunta `req.user = { sub, role, specialist_id?, client_id? }`.
- [ ] Middleware `authorizeRole(...roles)` — rechaza con 403 si `req.user.role` no está en la lista.
- [ ] Middleware `scopeFilter(resource)` — inyecta `req.scope` (cláusula WHERE de Prisma) según rol: admin ve todo, specialist ve solo sus recursos, client ve solo los suyos.
- [ ] Función `canModify(user, resource)` — devuelve `true` si el usuario es admin, o es el propietario (`ownerId === user.sub`), o el especialista responsable.
- [ ] Rate limiting: `/api/auth` máximo 20 req/min, `/api` máximo 200 req/min. Usa `express-rate-limit` v8 con opción `limit` (no `max`).
- [ ] Helmet y CORS configurados en `src/index.js`.

### 1.2 Usuarios (`src/routes/users.js`)

- [ ] `GET /api/users` — solo admin, con filtros `?search` y `?role`, paginado.
- [ ] `POST /api/users` — solo admin, crea usuario con hash bcryptjs, crea perfil especialista si `role === 'specialist'`.
- [ ] `PATCH /api/users/:id` — actualiza `name` y/o `bio` del especialista asociado.
- [ ] `DELETE /api/users/:id` — soft delete (`active: false`), nunca borra físicamente.
- [ ] `GET /api/users/:id/preferences` — devuelve `UserPreference` del usuario.
- [ ] `PATCH /api/users/:id/preferences` — upsert de `UserPreference` con campos: `color_profile_id`, `tts_enabled`, `text_size`, `sequential_mode`.

### 1.3 Especialistas (`src/routes/specialists.js`)

- [ ] `GET /api/specialists` — solo admin, incluye `user`, `_count { clients, activities }`.
- [ ] `GET /api/specialists/:id/clients` — lista clientes del especialista.

### 1.4 Clientes (`src/routes/clients.js`)

- [ ] `GET /api/clients` — filtrado por scope (admin ve todos, specialist ve los suyos), paginado, `?search` por nombre tutor/alumno.
- [ ] `POST /api/clients` — crea usuario con rol `client` + perfil `Client` + `UserPreference` inicial. Usa `specialist_id` del JWT si no se pasa explícitamente.
- [ ] `PATCH /api/clients/:id` — actualiza `childName`, `diagnosisNotes`.
- [ ] `DELETE /api/clients/:id` — soft delete del `User` asociado (`active: false`).

### 1.5 Categorías (`src/routes/categories.js`)

- [ ] `GET /api/categories` — scope: admin ve todas, specialist ve las suyas + las públicas aprobadas. Incluye `_count { objects }`.
- [ ] `POST /api/categories` — crea categoría. Si `is_public: true` y rol admin → `ownerId: null`, `status: 'approved'`. Si specialist → `status: 'private'`.
- [ ] `PATCH /api/categories/:id` — solo si `canModify`.
- [ ] `DELETE /api/categories/:id` — rechaza con 409 si hay objetos asociados.

### 1.6 Objetos (`src/routes/objects.js`)

- [ ] `GET /api/objects` — scope correcto, paginado, `?search`, `?category_id`.
- [ ] `GET /api/objects/:id` — incluye `representations` y `category`.
- [ ] `POST /api/objects` — crea objeto con `em` (emoji), `categoryId`, control de visibilidad.
- [ ] `PATCH /api/objects/:id` — `canModify`, actualiza `name`, `categoryId`, `em`.
- [ ] `DELETE /api/objects/:id` — rechaza con 409 si está en uso en `ActivityObject`. Borra imágenes de Cloudinary antes de eliminar.
- [ ] `GET /api/objects/:id/representations` — lista las 3 representaciones.
- [ ] `POST /api/objects/:id/representations` — sube imagen con `multer.memoryStorage()` + `cloudinary.uploader.upload_stream` (NO multer-storage-cloudinary). Para nivel 1 (3D) acepta JSON con `model_3d_url`. Hace upsert por `objectId_level`.
- [ ] `DELETE /api/objects/:id/representations/:level` — borra de Cloudinary por `cloudinaryPublicId` antes de borrar de BD.

### 1.7 Actividades (`src/routes/activities.js`)

- [ ] `GET /api/activities` — scope correcto, paginado, `?search`.
- [ ] `GET /api/activities/:id` — incluye `activityObjects` con `object.representations` ordenados por `sortOrder`.
- [ ] `POST /api/activities` — crea actividad con sus `activityObjects`. Valida que `specialist_id` venga del JWT.
- [ ] `PATCH /api/activities/:id` — `canModify`, actualiza `title`, `instructions`.
- [ ] `DELETE /api/activities/:id` — `canModify`, borra en cascada por Prisma.

### 1.8 Asignaciones (`src/routes/assignments.js`)

- [ ] `GET /api/assignments/client/:clientId` — devuelve asignaciones activas del cliente con actividad + objetos + representaciones.
- [ ] `GET /api/assignments` — con scope.
- [ ] `POST /api/assignments` — crea asignación individual.
- [ ] `POST /api/assignments/bulk` — asignación masiva: por `client_ids`, por `group_ids` (expande clientes del grupo) o `assign_all: true` (todos los clientes del especialista). Usa `upsert` para evitar duplicados.
- [ ] `PATCH /api/assignments/:id` — activa/desactiva con `is_active`.
- [ ] `POST /api/assignments/:id/complete` — marca `completedAt: new Date()`.

### 1.9 Grupos (`src/routes/groups.js`)

- [ ] `GET /api/groups` — scope: admin ve todos, specialist ve los suyos. Incluye `clients { id, childName }`.
- [ ] `POST /api/groups` — crea grupo con `specId`, conecta `client_ids`.
- [ ] `PATCH /api/groups/:id` — actualiza `name`, `color`, reemplaza `clients` con `set`.
- [ ] `DELETE /api/groups/:id` — borra grupo (no borra clientes).

### 1.10 Motor de juego (`src/routes/game.js`)

- [ ] `GET /api/game/session/:assignmentId` — devuelve sesión estructurada:
  ```json
  {
    "assignment_id": "...",
    "activity": { "title": "...", "instructions": "..." },
    "total_objects": 3,
    "steps": [
      {
        "index": 0,
        "object_id": "...",
        "object_name": "Perro",
        "object_emoji": "🐕",
        "media": {
          "l1": { "type": "3d",  "url": "https://sketchfab.com/..." },
          "l2": { "type": "img", "url": "https://res.cloudinary.com/..." },
          "l3": { "type": "img", "url": "https://res.cloudinary.com/..." }
        }
      }
    ]
  }
  ```
  Cada campo `media.lX` es `null` si no existe la representación.
- [ ] `POST /api/game/result` — guarda un `GameResult` con `assignmentId`, `activityObjectId`, `isCorrect`, `timeMs`.

### 1.11 Suscripciones (`src/routes/subscriptions.js`)

- [ ] `POST /api/subscriptions` — activa/renueva suscripción para `entity_type` (`specialist` | `client`). Calcula `expires` (+1 mes o +12 meses). Guarda en campo `subscription` (JSON) del modelo correspondiente. Programa email de aviso 15 días antes usando `setTimeout` + `nodemailer`.
- [ ] `GET /api/subscriptions/status/:entityType/:entityId` — devuelve estado calculado: `none`, `trial`, `active`, `grace` (hasta 15d tras expirar), `expired`. Incluye `daysLeft`.

### 1.12 Perfiles de color (`src/routes/colorProfiles.js`)

- [ ] `GET /api/color-profiles` — ordenados: predeterminado primero, resto alfabético.
- [ ] `POST /api/color-profiles` — solo admin.
- [ ] `PATCH /api/color-profiles/:id/set-default` — desactiva todos, activa el indicado.
- [ ] `DELETE /api/color-profiles/:id` — solo admin.

### 1.13 Panel admin (`src/routes/admin.js`)

- [ ] `GET /api/admin/stats` — cuenta: `users`, `specialists`, `clients`, `objects`, `categories`, `activities`, `assignments` (activos).
- [ ] `GET /api/admin/pending-approvals` — objetos y categorías con `status: 'pending'`, incluye `owner.name`.
- [ ] `PATCH /api/admin/approve/:type/:id` — cambia `status: 'approved'` y `ownerId: null` (pasa a ser público).
- [ ] `PATCH /api/admin/reject/:type/:id` — cambia `status: 'rejected'`, guarda `rejectedNote`.

### 1.14 Validaciones generales

- [ ] Todas las rutas que modifican datos verifican que el recurso existe antes de actuar (devuelven 404 si no).
- [ ] Errores de Prisma (constraint unique, FK violation) se capturan y devuelven 409 o 400 según corresponda.
- [ ] Express 5: los handlers `async` propagan errores automáticamente a `app.use((err,req,res,next)=>...)`. No hace falta `try/catch` en cada ruta, pero si usas `try/catch` asegúrate de llamar a `next(err)`.
- [ ] Respuesta estándar de éxito: `{ success: true, data: ... }`. Error: `{ success: false, error: { code, message } }`.
- [ ] Respuesta paginada: `{ success: true, data: [...], pagination: { total, page, limit, total_pages, has_next, has_prev } }`.

---

## PARTE 2 — FRONTEND (`client/`)

### 2.1 Infraestructura

- [ ] `src/api/index.js` — Axios con interceptor de request que adjunta `Authorization: Bearer <token>`. Interceptor de response que detecta `TOKEN_EXPIRED`, llama a `/api/auth/refresh`, actualiza `localStorage`, y reintenta la petición original. Si el refresh falla, redirige a `/login`.
- [ ] `src/stores/authStore.js` — Zustand 5 con `persist`. Métodos: `login()`, `logout()`, `updatePreferences()`. Getters: `isLoggedIn()`, `role()`.
- [ ] `src/stores/prefsStore.js` — Zustand 5 con `persist`. Gestiona `paletteId`, `fontSizeId` (con zoom en `document.documentElement.style.zoom`), `ttsEnabled`. Método `applyAll()` llamado en `useEffect` al montar `App`.
- [ ] `src/main.jsx` — importa de `react-router` (no `react-router-dom`). Usa `ReactDOM.createRoot`.
- [ ] `src/index.css` — Tailwind v4: `@import "tailwindcss"` (sin `@tailwind base/components/utilities`). Fuente via `@theme { --font-sans: 'Lexend Deca', ... }`. Variables CSS `--bg`, `--ac`, etc. para las 6 paletas.
- [ ] `vite.config.js` — plugin `@tailwindcss/vite` (sin `postcss.config.js`). Proxy `/api` → `http://localhost:3000`. `__dirname` calculado con `fileURLToPath(import.meta.url)`.

### 2.2 Routing (`src/App.jsx`)

- [ ] Rutas protegidas con `<RequireAuth>` que redirige a `/login` si no hay sesión.
- [ ] `<RoleRedirect>` en `/` que lleva a `/admin`, `/specialist/clients` o `/client` según rol.
- [ ] Rutas anidadas: `/specialist/*` usa `<Routes>` internas en `SpecialistHome`. Ídem `/admin/*`.
- [ ] Ruta catch-all `*` redirige a `/`.

### 2.3 Layout (`src/pages/Layout.jsx`)

- [ ] Topbar sticky con: logo, botones `A-`/`A+` (zoom global), toggle TTS, paletas de color como dots circulares, botón configuración, botón salir.
- [ ] Sidebar con `<NavLink>` que aplica clase activa. Se colapsa en mobile (botón ☰).
- [ ] Menú diferente por rol: 1 item para cliente, 4 para especialista, 7 para admin.
- [ ] Al hacer logout llama a `authStore.logout()` y navega a `/login`.

### 2.4 Login (`src/pages/Login.jsx`)

- [ ] Formulario email + contraseña. Manejo de errores `INVALID_CREDENTIALS`.
- [ ] Selector de paleta de accesibilidad visible sin autenticar.
- [ ] Botones de demo rápido (rellena email/contraseña de los 3 roles).
- [ ] Redirección por rol tras login exitoso.

### 2.5 Configuración (`src/pages/Settings.jsx`)

- [ ] Selector de paleta (6 opciones con preview de color).
- [ ] Selector de tamaño de texto (4 niveles: A-, A, A+, A++). Al cambiar aplica `document.documentElement.style.zoom` y guarda en store.
- [ ] Toggle de TTS.
- [ ] Formulario de cambio de contraseña (verifica coincidencia antes de enviar).

### 2.6 Vista cliente (`src/pages/client/Home.jsx`)

- [ ] Carga asignaciones activas del cliente vía `GET /api/assignments/client/:clientId`.
- [ ] Tarjeta de actividad muestra emojis de objetos, título, número de objetos, badge de estado.
- [ ] Botón "Empezar" que llama a `GET /api/game/session/:assignmentId` y abre el `<GameEngine>`.
- [ ] Al completar llama a `POST /api/assignments/:id/complete`.
- [ ] Sección separada para actividades completadas (opacity reducida).

### 2.7 Motor de juego (`src/components/game/GameEngine.jsx`)

El flujo es: **objeto → L1 → L2 → L3 → siguiente objeto (usuario elige)**

- [ ] Estado: `remIds[]` (IDs de objetos pendientes), `objPos`, `lvlIdx` (0-2), `exIdx`, `doneKeys` (Set de claves `objId_lvlId_exId`), `fb` (feedback overlay).
- [ ] `getMedia(step, lvlId)` — accede a `step.media.l1/l2/l3`. Devuelve `null` si no existe (no fallback entre niveles).
- [ ] `advance()` — cascada: si hay más ejercicios en el nivel → `exIdx+1`. Si no, si hay más niveles → muestra overlay `'lvl'` 1.4s y pasa a `lvlIdx+1`. Si no, quedan más objetos → muestra overlay `'objdone'` con picker. Si no quedan objetos → overlay `'done'` y llama `onComplete()`.
- [ ] `handleAnswer(ok)` — registra resultado vía `onResult()`, muestra `'ok'` o `'ko'`, tras 1.4s / 1.1s llama a `advance()` si ok.
- [ ] `pickNext(objectId)` — elimina objeto actual de `remIds`, posiciona en el elegido, resetea `lvlIdx=0`, `exIdx=0`.
- [ ] **Ejercicio Mostrar (show)**: muestra `<MediaDisplay>` + nombre + botón "Siguiente".
  - L1: iframe Sketchfab si `media.l1` existe, sino placeholder con emoji.
  - L2: imagen fotografía (`media.l2`), sino placeholder.
  - L3: imagen dibujo (`media.l3`), sino placeholder. **Nunca mostrar la foto en L3.**
- [ ] **Ejercicio Reconocer (recognize)**: grid 3×2 con el objeto correcto + 5 distractores (aleatorios de `allSteps`). Al acertar → borde verde. Al fallar → borde rojo + animación shake. Muestra imagen si existe, emoji si no.
- [ ] **Ejercicio Relacionar (relate)**: 6 celdas = 3 copias del objeto correcto + 3 distractores. Selección múltiple. "Comprobar" activo solo si hay selección.
- [ ] **Ejercicio Memorizar (memorize)**: grid 4×2 = 2 copias del objeto + 6 de otros (3 objetos × 2). Volteo de cartas. Al emparejar el objeto objetivo → `onAnswer(true)`. **Sin animación scale en hover ni click.**
- [ ] Barra de progreso porcentual arriba.
- [ ] Indicadores de nivel (círculos L1/L2/L3) con estado: completado (verde ✓), actual (azul), pendiente (gris).
- [ ] Pestañas de ejercicios (solo L2/L3) con estado: completado, actual, pendiente.
- [ ] TTS: `onMouseEnter` en nombre del objeto llama a `speak(name)`.
- [ ] Overlay de feedback (`ok`, `ko`, `lvl`, `objdone`, `done`) sin `position:fixed` (usa contenedor en flujo normal con `min-height` para que el iframe no colapse).

### 2.8 Vista especialista (`src/pages/specialist/Home.jsx`)

Cuatro pestañas: Clientes / Actividades / Objetos / Grupos.

**Clientes:**
- [ ] Lista con búsqueda en tiempo real. Muestra nombre alumno, tutor, grupos, badge suscripción.
- [ ] Modal crear/editar cliente: nombre tutor, nombre alumno, email, contraseña (solo al crear), notas clínicas, selector de grupos.
- [ ] Borrar cliente con confirmación (`<Confirm>`).
- [ ] Click en badge de suscripción abre `<SubscriptionModal>`.

**Actividades:**
- [ ] Lista con búsqueda. Muestra emojis de objetos, título, conteo.
- [ ] Modal crear actividad: título, selector de objetos filtrado por categoría (grid estable sin reordenarse), asignación (todos / clientes individuales con búsqueda / grupos).
- [ ] Modal editar actividad: precarga datos existentes. Botón "Guardar cambios".
- [ ] Borrar con confirmación.

**Objetos:**
- [ ] Lista con búsqueda + filtro de categoría. Badges 🧊/📷/📝 muestran si tiene cada representación.
- [ ] Acordeón expandible por objeto mostrando las 3 representaciones:
  - L1 (3D): campo de URL Sketchfab + botón "Guardar". Muestra iframe si ya existe.
  - L2 (Foto): botón "Subir" con `<input type="file">`. Muestra miniatura si existe.
  - L3 (Dibujo): igual que L2. **Solo acepta imágenes, nunca muestra foto en L3.**
- [ ] Upload llama a `objectsApi.uploadRepresentation(id, formData)` con `Content-Type: multipart/form-data`.
- [ ] Modal crear/editar objeto: nombre, emoji, categoría, URL 3D opcional.
- [ ] Borrar con confirmación.

**Grupos:**
- [ ] Lista con búsqueda. Borde izquierdo del color del grupo. Muestra número de miembros y nombres.
- [ ] Modal crear/editar: nombre, selector de color (7 opciones), checkbox de clientes.
- [ ] Borrar con confirmación (avisa que no borra clientes).

### 2.9 Vista admin (`src/pages/admin/Home.jsx`)

Siete pestañas: Panel / Especialistas / Clientes / Actividades / Objetos / Grupos / Suscripciones.

**Panel:**
- [ ] 6 stats cards: especialistas, clientes, actividades, objetos, categorías, asignaciones activas.
- [ ] Tarjetas: "próximos a vencer en 15d" y "estado de suscripciones" (activa/prueba/gracia/caducada con conteos).
- [ ] Cola de aprobaciones pendientes con botones Aprobar/Rechazar.

**Especialistas:**
- [ ] Lista con búsqueda. Muestra badge estado/suscripción.
- [ ] Modal crear especialista (llama a `POST /api/users` con `role: 'specialist'`).
- [ ] Modal editar: nombre, email, bio.
- [ ] Click en badge suscripción abre `<SubscriptionModal>`.

**Clientes:** igual que en especialista pero admin ve todos + puede ver especialista asignado.

**Actividades:** vista de solo lectura con borrar.

**Objetos:** igual que en especialista pero con control de visibilidad pública.

**Grupos:** gestión completa (CRUD) con todos los clientes del sistema.

**Suscripciones:**
- [ ] Lista unificada de especialistas + clientes con búsqueda y filtro por estado.
- [ ] Botón "Gestionar" en cada fila abre `<SubscriptionModal>`.

### 2.10 Modal de suscripción (`src/components/modals/SubscriptionModal.jsx`)

- [ ] Selector de plan: Básico / Premium con precio según facturación.
- [ ] Selector de facturación: Mensual / Anual (20% descuento).
- [ ] Selector de método: 💳 Tarjeta / 🅿️ PayPal / 📱 Bizum.
  - Tarjeta: campos número, caducidad, CVC.
  - PayPal: campo email.
  - Bizum: muestra número de teléfono y concepto de pago.
- [ ] Aviso de cortesía (15 días tras caducar).
- [ ] Al confirmar: llama a `POST /api/subscriptions`, muestra "✅ ¡Suscripción activada!" y cierra tras 1.8s.

### 2.11 Componentes UI (`src/components/ui/index.jsx`)

- [ ] `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">` — Tailwind v4, colores via `var(--ac)`, `var(--er)`, etc.
- [ ] `<Badge variant="default|blue|green|red|amber|gold">`.
- [ ] `<Input label error>` — focus aplica `var(--ac)`.
- [ ] `<Select label>`.
- [ ] `<Textarea label>`.
- [ ] `<Modal open onClose title maxWidth>` — cierra al click fuera.
- [ ] `<Confirm open message onConfirm onCancel>`.
- [ ] `<SearchBar value onChange placeholder extra>` — icono 🔍 con padding-left.
- [ ] `<Spinner size>` — SVG animado.
- [ ] `<SubBadge sub>` — calcula estado desde `sub.expires`: "Sin suscripción" / "Prueba 15d" / "Activa" / "Vence pronto" (≤15d) / "Cortesía 15d" / "Caducada".
- [ ] `<Empty icon title subtitle>`.

---

## PARTE 3 — FUNCIONALIDADES TRANSVERSALES

### 3.1 Accesibilidad

- [ ] 6 paletas de alto contraste: predeterminado, negro/blanco, blanco/negro, deuteranopía, tritanopía, fondo amarillo. Aplicadas como clase CSS en `<body>`.
- [ ] Zoom global: `document.documentElement.style.zoom` con valores `0.85 / 1.0 / 1.2 / 1.45`. Escala TODO (cards, padding, imágenes, fuentes).
- [ ] TTS (Web Speech API): `useTTS()` hook que llama `SpeechSynthesisUtterance` en español (`lang: 'es-ES'`, `rate: 0.9`). `speak()` no hace nada si `ttsEnabled === false`.
- [ ] Preferencias persistidas en Zustand `persist` (localStorage) y sincronizadas con la API en `PATCH /api/users/:id/preferences`.
- [ ] Fuente Lexend Deca (alta legibilidad para baja visión) vía Google Fonts.

### 3.2 Persistencia de datos

- [ ] PostgreSQL: toda la BD persistida en volumen Docker `postgres_data`.
- [ ] Redis: persistencia AOF (`--appendonly yes`) en volumen `redis_data`. Sin esto, la blacklist de JWT se pierde al reiniciar.
- [ ] `node_modules` de server y client en volúmenes Docker separados para evitar que el bind mount los sobreescriba.

### 3.3 Imágenes

- [ ] Las imágenes NUNCA se almacenan en el servidor local. Siempre van a Cloudinary.
- [ ] El servidor recibe el archivo en memoria (`multer.memoryStorage()`), lo envía a Cloudinary via `upload_stream`, y guarda `secure_url` + `public_id` en BD.
- [ ] Al borrar un objeto o representación, se llama a `cloudinary.uploader.destroy(publicId)` antes de borrar el registro.
- [ ] Los modelos 3D son embeds externos de Sketchfab (URL en BD, nunca archivos).
- [ ] `getMedia(step, lvlId)` en el cliente:
  - L1 → `step.media.l1` (tipo `3d` o `null`)
  - L2 → `step.media.l2` (tipo `img` o `null`) — **solo foto**
  - L3 → `step.media.l3` (tipo `img` o `null`) — **solo dibujo, sin fallback a foto**

### 3.4 Suscripciones

- [ ] Campo `subscription` (JSON) en modelos `Specialist` y `Client`: `{ plan, billing, status, expires }`.
- [ ] Lógica de estado: `active` mientras `expires > now`. `grace` hasta 15 días después. `expired` pasados los 15 días.
- [ ] Email de aviso 15 días antes del vencimiento programado con `setTimeout` (en producción usar un job scheduler como `node-cron`).
- [ ] Las suscripciones son independientes: la del especialista no afecta a la de sus clientes.

### 3.5 Seed inicial

Al ejecutar `npm run db:seed`, la BD debe contener:
- [ ] 3 usuarios: admin, especialista, cliente (con contraseñas documentadas en `README.md`).
- [ ] 6 paletas de color predeterminadas.
- [ ] 4 categorías públicas aprobadas.
- [ ] 12 objetos públicos aprobados (con emoji y categoría).
- [ ] 1 modelo 3D para el objeto "Perro" (Sketchfab embed URL).
- [ ] 1 actividad "Animales del campo" con 3 objetos asignada al cliente demo.
- [ ] 1 grupo de demo.

---

## PARTE 4 — INSTRUCCIONES PARA COPILOT

1. **Lee primero** el archivo completo antes de modificarlo.
2. **No cambies** la estructura de directorios, los nombres de los archivos, ni el esquema Prisma salvo que sea estrictamente necesario para implementar una funcionalidad faltante.
3. **No instales** paquetes nuevos sin justificación. El proyecto ya tiene todo lo necesario.
4. Si un endpoint o componente ya existe y funciona correctamente, **no lo toques**.
5. Para cada funcionalidad que implementes, añade un comentario `// ✅ IMPLEMENTADO: <descripción breve>` en la línea donde empieza la función.
6. Para cada funcionalidad que corrijas, añade `// 🔧 CORREGIDO: <qué había mal>`.
7. Si encuentras algo que no puede implementarse con el código actual sin cambios de arquitectura, añade un comentario `// ⚠️ PENDIENTE: <razón>` y descríbelo al final de tu respuesta.
8. Tras completar la auditoría, genera un resumen con tres secciones: **✅ Ya implementado**, **🔧 Corregido**, **⚠️ Pendiente**.
