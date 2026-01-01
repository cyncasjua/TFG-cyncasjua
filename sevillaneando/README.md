# Sevillaneando

Monorepo inicial para una app móvil (React Native con Expo) y un backend (NestJS) con PostgreSQL + PostGIS. Integra autenticación con Firebase (stubs), almacenamiento de imágenes en Firebase Storage (stubs), mapas con OpenStreetMap vía `react-native-maps`, y un placeholder de moderación de imágenes con NSFW.js.

## Estructura
- apps/mobile: cliente React Native (Expo, TypeScript).
- apps/backend: API NestJS + TypeORM + PostgreSQL/PostGIS.
- docker-compose.yml: servicio de base de datos PostGIS listo para desarrollo.

## Prerrequisitos
- Node.js 18+
- npm o pnpm
- Docker (para la base de datos)

## Pasos rápidos
1. Instala dependencias en cada paquete (o usa workspaces):
   - `npm install` (raíz con workspaces) o `npm install` dentro de cada app.
2. Base de datos: `docker compose up -d db` (usa PostGIS).
3. Backend: copia `apps/backend/.env.example` a `.env` y ajusta credenciales; luego `npm run backend`.
4. Mobile: copia `apps/mobile/.env.example` a `.env`, ajusta claves de Firebase; luego `npm run mobile` (abre Metro Bundler de Expo).

## Notas
- Mapas: se usa OpenStreetMap a través de `react-native-maps` con `UrlTile`. Cada evento muestra marcador y botón para abrir navegación externa (Google/Apple Maps).
- Moderación: hook `useNsfwGuard` es un placeholder para integrar NSFW.js (TensorFlow.js).
- Auth: middleware/guard en backend está preparado para verificar ID tokens de Firebase (stub para conectar `firebase-admin`).
