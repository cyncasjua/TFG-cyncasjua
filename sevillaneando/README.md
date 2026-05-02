# Sevillaneando

Monorepo inicial para una app móvil (React Native con Expo) y un backend (NestJS) con PostgreSQL + PostGIS. Integra autenticación con Firebase (stubs), almacenamiento de imágenes en Firebase Storage (stubs), mapas con OpenStreetMap vía `react-native-maps`, y un placeholder de moderación de imágenes con NSFW.js.

## Estructura
- apps/frontend: cliente React Native (Expo, TypeScript).
- apps/backend: API NestJS + TypeORM + PostgreSQL/PostGIS.
- docker-compose.yml: servicio de base de datos PostGIS listo para desarrollo.

## Prerrequisitos
- Node.js 18+
- npm o pnpm
- Docker (para la base de datos)

## Pasos rápidos
1. Instala dependencias en cada app:
   - `cd apps/backend && npm install`
   - `cd apps/frontend && npm install`
2. Base de datos: `docker compose up -d db` (usa PostGIS).
3. Backend: crea `apps/backend/.env` con las variables minimas y arranca con `npm run start:dev`.
4. Frontend: crea `apps/frontend/.env` con las variables minimas y arranca con `npx expo start`.

Para los valores exactos de variables y mas detalle de ejecucion local, consulta [docs/manual-desarrollo.md](docs/manual-desarrollo.md).

## Notas
- Mapas: se usa OpenStreetMap a través de `react-native-maps` con `UrlTile`. Cada evento muestra marcador y botón para abrir navegación externa (Google/Apple Maps).
- Moderación: hook `useNsfwGuard` es un placeholder para integrar NSFW.js (TensorFlow.js).
- Auth: middleware/guard en backend está preparado para verificar ID tokens de Firebase (stub para conectar `firebase-admin`).
