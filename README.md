# Proyecto Gigi — App educativa para baja visión

Aplicación web fullstack para trabajar la conceptualización del lenguaje en niños con baja visión (2–6 años) mediante objetos en tres niveles de abstracción: modelo 3D, fotografía y dibujo.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18 · Vite · React Router v6 · Zustand · Tailwind CSS |
| Backend | Node.js · Express 5 · Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Caché / Sesiones | Redis |
| Imágenes | Cloudinary |
| Auth | JWT (access 15min + refresh 7d) |

## Requisitos previos

*   Node.js ≥ 18
*   PostgreSQL 16
*   Redis
*   Cuenta en Cloudinary (gratuita)

## Instalación rápida

```
# 1. Clonar y entrar al proyecto
git clone <repo> proyecto-gigi && cd proyecto-gigi

# 2. Instalar todas las dependencias
npm run install:all

# 3. Configurar variables de entorno
cp server/.env.example server/.env
# → edita server/.env con tus valores reales

# 4. Crear la base de datos y aplicar migraciones
npm run db:migrate

# 5. Cargar datos iniciales (paletas, admin, objetos de ejemplo)
npm run db:seed

# 6. Arrancar en desarrollo (server + client en paralelo)
npm run dev
```

El cliente corre en http://localhost:5173  
La API corre en http://localhost:3000

## Credenciales iniciales (seed)

| Rol | Email | Contraseña |
| --- | --- | --- |
| Admin | admin@proyectogigi.com | Admin1234! |
| Especialista | especialista@proyectogigi.com | Spec1234! |
| Cliente | familia@ejemplo.com | Client1234! |

⚠️ **Cambia estas contraseñas antes de desplegar a producción.**

## Estructura del proyecto

```
proyecto-gigi/
├── server/                 # API REST (Express + Prisma)
│   ├── prisma/
│   │   ├── schema.prisma   # Esquema completo de BD
│   │   └── seed.js         # Datos iniciales
│   ├── src/
│   │   ├── index.js        # Punto de entrada
│   │   ├── lib/            # Prisma, Redis, Cloudinary
│   │   ├── middleware/     # Auth JWT, RBAC, Upload
│   │   └── routes/         # Todos los endpoints REST
│   └── package.json
│
├── client/                 # SPA React
│   ├── src/
│   │   ├── api/            # Cliente Axios
│   │   ├── stores/         # Zustand (auth, prefs)
│   │   ├── hooks/          # useApi, useTTS
│   │   ├── components/
│   │   │   ├── game/       # GameEngine + 4 ejercicios
│   │   │   ├── ui/         # Componentes compartidos
│   │   │   └── modals/     # Modales CRUD
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── client/     # Vista padre/tutor
│   │       ├── specialist/ # Vista especialista
│   │       └── admin/      # Panel administración
│   └── package.json
│
└── package.json            # Workspace raíz
```

## Despliegue a producción

```
# Build del frontend
npm run build

# El build queda en client/dist/ → sírvelo con Nginx o Vercel

# Backend → Railway, Render, o cualquier VPS con Docker
# docker-compose up --build
```

## Roles del sistema

*   **Admin** — gestión global: usuarios, contenido público, suscripciones
*   **Especialista** — gestiona sus clientes, crea actividades y objetos privados
*   **Cliente** — padre/tutor que accede para el niño; ve solo las actividades asignadas

## Flujo pedagógico

Cada actividad trabaja un objeto a la vez pasando por 3 niveles:

1.  **Nivel 1 — Modelo 3D** · Mostrar (iframe Sketchfab)
2.  **Nivel 2 — Fotografía** · Mostrar · Reconocer · Relacionar · Memorizar
3.  **Nivel 3 — Dibujo** · Mostrar · Reconocer · Relacionar · Memorizar

Al completar los 3 niveles de un objeto, el cliente elige con qué objeto continuar.