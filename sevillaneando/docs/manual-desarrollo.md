# Manual de Desarrollo (Entorno y Versiones)

## 1. Alcance
Este manual describe el entorno de desarrollo para el monorepo Sevillaneando y las versiones base recomendadas.

## 2. Arquitectura del proyecto
- Frontend movil: Expo + React Native + TypeScript.
- Backend API: NestJS + TypeORM + TypeScript.
- Base de datos: PostgreSQL 15 con PostGIS 3.3 (Docker).

## 3. Versiones relevantes del proyecto
### 3.1 Sistema y herramientas
- Node.js: 18 o superior (recomendado 20 LTS).
- npm: 9 o superior.
- Docker Desktop: version estable reciente.

### 3.2 Frontend (apps/frontend)
- Expo: ~54.0.33.
- React: 19.1.0.
- React Native: 0.81.5.
- TypeScript: ~5.9.2.

### 3.3 Backend (apps/backend)
- NestJS core/common/platform-express: ^11.x.
- TypeORM: ^0.3.20.
- PostgreSQL driver (pg): ^8.11.5.
- TypeScript: ~5.3.3 (forzado por overrides).

### 3.4 Base de datos (docker-compose)
- Imagen: postgis/postgis:15-3.3.
- Puerto local: 5433 (host) -> 5432 (contenedor).

## 4. Preparacion inicial
Desde la raiz del workspace:

```bash
cd sevillaneando
npm install
```

Instalar dependencias por app (si hiciera falta):

```bash
cd apps/backend
npm install
cd ../frontend
npm install
```

## 5. Variables de entorno
Actualmente no se encontraron archivos .env.example en el workspace, por lo que se recomienda crearlos manualmente.

### 5.1 Backend (apps/backend/.env)
Variables minimas:

```env
PORT=3000
NODE_ENV=development

DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=sevillaneando

JWT_SECRET=changeme

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

TICKETMASTER_API_KEY=
GEMINI_API_KEY=
SCRAPER_SYSTEM_UID=system-scraper-uid
SCRAPER_SYSTEM_EMAIL=scraper.bot@sevillaneando.local
SCRAPER_SYSTEM_NAME=Sevillaneando Bot
LEGACY_SCRAPER_EMAIL=mod@demo.com
```

### 5.2 Frontend (apps/frontend/.env)
Variables minimas:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_SHARE_BASE_URL=

EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

## 6. Ejecucion en local
### 6.1 Levantar base de datos

```bash
cd sevillaneando
docker compose up -d db
```

### 6.2 Levantar backend

```bash
cd apps/backend
npm run start:dev
```

### 6.3 Levantar frontend

```bash
cd apps/frontend
npx expo start
```

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

## 8. Convenciones de trabajo
- Estilo: ver STYLE_GUIDE.md.
- Commits: conventional commits (feat, fix, docs, style, refactor, test, chore).
- Rama recomendada por feature: feature/nombre-corto.

## 9. Troubleshooting rapido
### El backend no arranca
- Revisar que PostgreSQL este accesible en el puerto configurado.
- Verificar variables DATABASE_* y JWT_SECRET.
- Revisar colisiones de puerto en PORT.

### Expo no conecta con backend
- Verificar EXPO_PUBLIC_API_URL.
- Si pruebas en movil fisico, usar URL accesible por red y no localhost.

### Firebase no valida tokens
- Revisar FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.
- Confirmar formato de FIREBASE_PRIVATE_KEY con saltos de linea escapados (\n).