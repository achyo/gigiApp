# Proyecto Gigi

Aplicación web fullstack para trabajar la conceptualización del lenguaje en niños con baja visión de 2 a 6 años mediante objetos presentados en tres niveles de abstracción: modelo 3D, fotografía y dibujo.

## Stack real

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 · Vite 8 · React Router 7 · Zustand 5 · Tailwind CSS 4 |
| Backend | Node.js 20+ · Express 5 · Prisma 7 |
| Base de datos | PostgreSQL 16 |
| Caché | Redis 7 |
| Media | Cloudinary |
| Autenticación | JWT access 15 min + refresh 7 días |
| Contenedores | Docker Compose |

## Requisitos

- Node.js 20.19 o superior
- npm 10 o superior
- Docker Desktop si vas a usar el flujo con contenedores
- Cuenta de Cloudinary para subida de imágenes

## Estructura

```text
gigiApp/
├── client/                  # SPA React
├── server/                  # API Express + Prisma
├── docker-compose.yml       # Stack local con postgres, redis, server y client
├── package.json             # Workspace raíz
└── COPILOT_AUDIT_PROMPT.md  # Checklist funcional del proyecto
```

## Configuración

El backend usa variables de entorno en `server/.env` y Prisma 7 se configura desde `server/prisma.config.ts`.

Pasos recomendados:

```bash
cp server/.env.example server/.env
```

Después ajusta al menos:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_*`
- `FRONTEND_URL`

## Desarrollo local sin Docker

Instala dependencias del workspace:

```bash
npm install
```

Genera cliente Prisma 7, aplica migraciones y carga seed:

```bash
npm run db:migrate --workspace=server
npm run db:generate --workspace=server
npm run db:seed --workspace=server
```

Arranque en desarrollo:

```bash
npm run dev
```

Servicios esperados:

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`

## Desarrollo con Docker

El flujo Docker del repositorio está preparado para:

- persistir PostgreSQL en el volumen `postgres_data`
- persistir Redis en `redis_data` con AOF habilitado
- mantener `node_modules` de frontend y backend en volúmenes separados
- regenerar Prisma y aplicar migraciones al arrancar el backend
- refrescar dependencias dentro de los contenedores cuando cambia `package.json`

Levantar todo el stack:

```bash
docker compose up -d --build postgres redis server client
```

Ver logs:

```bash
docker compose logs -f server
docker compose logs -f client
```

Sembrar datos demo dentro del contenedor del backend:

```bash
docker compose exec server npm run db:seed
```

Parar el stack:

```bash
docker compose down
```

Parar y borrar volúmenes persistidos:

```bash
docker compose down -v
```

## Prisma 7

El proyecto ya está migrado a Prisma 7.

Puntos importantes:

- La conexión CLI ya no se define en `schema.prisma`, sino en `server/prisma.config.ts`.
- El runtime usa `@prisma/adapter-pg` y `pg` para crear `PrismaClient`.
- El seed reutiliza la misma inicialización del cliente Prisma del backend.
- El backend ejecuta este orden de arranque: `npm install` → `prisma generate` → `prisma migrate deploy` → `nodemon`.

Comandos útiles del backend:

```bash
npm run db:generate --workspace=server
npm run db:migrate --workspace=server
npm run db:migrate:prod --workspace=server
npm run db:seed --workspace=server
npm run db:reset --workspace=server
npm run db:studio --workspace=server
```

## Seed y credenciales demo

El seed crea:

- 3 usuarios demo: admin, especialista y cliente
- 6 paletas de color
- 4 categorías públicas aprobadas
- 12 objetos públicos aprobados
- 1 modelo 3D para `Perro`
- 1 actividad demo `Animales del campo`
- 1 asignación activa al cliente demo
- 1 grupo demo

Credenciales:

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin | admin@proyectogigi.com | Admin1234! |
| Especialista | especialista@proyectogigi.com | Spec1234! |
| Cliente | familia@ejemplo.com | Client1234! |

## Funcionalidad verificada

Sobre el stack Docker levantado se verificó correctamente:

- `GET /api/health`
- login de admin, especialista y cliente
- CRUD representativo de grupos, clientes, categorías, objetos y actividades
- activación y consulta de suscripciones para especialista y cliente
- sesión de juego y guardado de resultados
- respuestas `delete` normalizadas en la API

## Roles del sistema

- Admin: gestión global, aprobaciones, usuarios, suscripciones y contenido público
- Especialista: gestiona sus clientes, grupos, actividades y objetos
- Cliente: accede a actividades asignadas y ejecuta el flujo de juego

## Flujo pedagógico

Cada objeto se trabaja por niveles:

1. Nivel 1: modelo 3D
2. Nivel 2: fotografía
3. Nivel 3: dibujo

En los niveles 2 y 3 pueden aparecer ejercicios de mostrar, reconocer, relacionar y memorizar. Al terminar un objeto, el usuario elige cuál continuar cuando quedan más pendientes.

## Build de frontend

```bash
npm run build
```

El resultado queda en `client/dist`.

## Troubleshooting

### Docker en Windows

- Si el frontend o el backend parecen ignorar cambios de `package.json`, reinicia los servicios con `docker compose up -d server client`. El `docker-compose.yml` ya fuerza `npm install` al arrancar para resincronizar los volúmenes de `node_modules`.
- Si quieres reiniciar desde cero dependencias, base de datos y caché, usa `docker compose down -v` y luego `docker compose up -d --build postgres redis server client`.
- Si Vite no detecta bien cambios de archivos en Windows, el contenedor del cliente ya arranca con `CHOKIDAR_USEPOLLING=true` y `VITE_USE_POLLING=true`.

### Prisma 7

- Si `prisma generate` falla con errores sobre `url` en `schema.prisma`, revisa que la conexión esté definida en `server/prisma.config.ts` y no en `server/prisma/schema.prisma`.
- Si el backend falla al construir `PrismaClient`, comprueba que estén instalados `@prisma/adapter-pg` y `pg`, y que `DATABASE_URL` exista en `server/.env` o en el entorno del contenedor.
- Si cambias dependencias de Prisma y el contenedor sigue usando una versión antigua, reinicia `server` para refrescar el volumen `server_node_modules`.
- Prisma 7 puede mostrar una advertencia `EBADENGINE` relacionada con paquetes opcionales de desarrollo bajo Node 20. En esta aplicación no bloquea generación, migraciones ni runtime.