# Manual de Desarrollo

## 1. Alcance

Este manual describe el entorno de desarrollo para el monorepo Sevillaneando, las versiones base recomendadas y el proceso para arrancar la aplicacion en local.

## 2. Arquitectura del proyecto

- Frontend movil: Expo + React Native + TypeScript.
- Backend API: NestJS + TypeORM + TypeScript.
- Base de datos: PostgreSQL 15 con PostGIS 3.3 (Docker).

## 3. Versiones relevantes del proyecto

### 3.1 Sistema y herramientas

- Node.js: 18 o superior (recomendado 20 LTS).
- npm: 9 o superior.
- Docker Desktop: version estable reciente.

### 3.2 Frontend (`apps/frontend`)

- Expo: ~54.0.33.
- React: 19.1.0.
- React Native: 0.81.5.
- TypeScript: ~5.9.2.

### 3.3 Backend (`apps/backend`)

- NestJS core/common/platform-express: ^11.x.
- TypeORM: ^0.3.20.
- PostgreSQL driver (pg): ^8.11.5.
- TypeScript: ~5.3.3 (forzado por overrides).

### 3.4 Base de datos (docker-compose)

- Imagen: postgis/postgis:15-3.3.
- Puerto local: 5433 (host) → 5432 (contenedor).

## 4. Preparacion inicial

Desde la raiz del monorepo:

```bash
cd sevillaneando
npm install
```

Instalar dependencias por app si fuera necesario:

```bash
cd apps/backend && npm install
cd ../frontend && npm install
```

## 5. Gestion de variables de entorno

El proyecto usa ficheros `.env` separados por entorno. **Nunca commitear estos ficheros** (estan en `.gitignore`).

### 5.1 Estructura de ficheros

```text
apps/backend/
  .env.development   # valores locales (docker postgres, localhost, etc.)
  .env.production    # plantilla con valores de produccion (rellenar con secretos reales)

apps/frontend/
  .env.development   # apunta al backend local
  .env.production    # apunta al backend en produccion
  .env               # fichero activo (se genera copiando uno de los anteriores al ejecutar los scripts)
```

El backend **no necesita un `.env` activo**: carga automaticamente `.env.${NODE_ENV}` gracias a `ConfigModule.forRoot({ envFilePath: '.env.development' | '.env.production' })`.

El frontend **si necesita un `.env`**: los scripts `start:dev` y `start:prod` copian el fichero correcto antes de arrancar Expo.

### 5.2 Backend (`apps/backend/.env.development`)

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006

DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=sevillaneando
DATABASE_SSL=false

JWT_SECRET=changeme-dev-secret

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

TICKETMASTER_API_KEY=
GEMINI_API_KEY=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SCRAPER_SYSTEM_UID=system-scraper-uid
SCRAPER_SYSTEM_EMAIL=scraper.bot@sevillaneando.local
SCRAPER_SYSTEM_NAME=Sevillaneando Bot
LEGACY_SCRAPER_EMAIL=mod@demo.com
```

> **FIREBASE_PRIVATE_KEY**: debe incluir los saltos de linea como `\n` literales dentro de comillas dobles:
> `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

### 5.3 Frontend (`apps/frontend/.env.development`)

```env
# Para emulador Android usar: http://10.0.2.2:3000
# Para dispositivo fisico usar la IP de tu maquina: http://192.168.1.X:3000
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SHARE_BASE_URL=http://localhost:3000/events

EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

> **EXPO_PUBLIC_FIREBASE_APP_ID**: Android e iOS tienen IDs distintos. El de iOS tiene forma `1:NNNNN:ios:XXXX`, el de Android `1:NNNNN:android:XXXX`. Usa el que corresponda a la plataforma con la que compilas.

## 6. Ejecucion en local

### 6.1 Levantar base de datos

```bash
cd sevillaneando
docker compose up -d db
```

Esto arranca PostgreSQL + PostGIS en el puerto 5433 del host.

### 6.2 Levantar backend en modo desarrollo

```bash
cd apps/backend
npm run start:dev
```

Este script pasa `NODE_ENV=development`, lo que hace que el backend cargue `.env.development` y habilite `synchronize: true` en TypeORM (las tablas se crean y actualizan automaticamente).

### 6.3 Levantar frontend en modo desarrollo

```bash
cd apps/frontend
npm run start:dev
```

Este script copia `.env.development` a `.env` y arranca el servidor Expo. Escaneando el QR desde la app Expo Go se conecta al backend local.

- **Dispositivo fisico**: cambia `EXPO_PUBLIC_API_URL` en `.env.development` a la IP local de tu maquina (p. ej. `http://192.168.1.42:3000`).
- **Emulador Android**: usa `http://10.0.2.2:3000` en lugar de `localhost`.

## 7. Calidad de codigo

### Backend

```bash
npm run lint
npm run type-check
npm run test
```

### Frontend

```bash
npm run lint
npm run type-check
```

Ejecutar antes de cada commit. Ver convenciones en `STYLE_GUIDE.md`.

## 8. Convenciones de trabajo

- Estilo: ver `STYLE_GUIDE.md`.
- Commits: Conventional Commits (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`) con gitmoji.
- Rama recomendada por feature: `feature/nombre-corto`.

## 9. Notas sobre comportamiento segun entorno

| Comportamiento | development | production |
| --- | --- | --- |
| `synchronize` (TypeORM) | `true` — crea/altera tablas al arrancar | `false` — las tablas deben existir previamente |
| Fichero `.env` cargado | `.env.development` | `.env.production` |
| Seed de eventos | Se ejecuta si la tabla esta vacia | Igual — solo inserta si no hay datos |
| Puerto BD | 5433 (Docker local) | 5432 (BD gestionada) |
| SSL a BD | `false` | `true` |

## 10. Troubleshooting rapido

### El backend no arranca

- Verificar que PostgreSQL este accesible: `docker compose ps` y revisar el puerto 5433.
- Revisar las variables `DATABASE_*` en `.env.development`.
- Revisar colisiones de puerto con la variable `PORT`.

### Expo no conecta con backend

- Verificar `EXPO_PUBLIC_API_URL` en `.env.development`.
- En dispositivo fisico, usar la IP de red local en lugar de `localhost`.
- En emulador Android, usar `http://10.0.2.2:3000`.

### Firebase no valida tokens

- Revisar `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.
- Confirmar que `FIREBASE_PRIVATE_KEY` tiene los saltos de linea escapados como `\n`.
