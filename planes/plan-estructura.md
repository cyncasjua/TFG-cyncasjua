# Plan: Mejora de estructura del proyecto Sevillaneando

## Contexto
El proyecto es un TFG con monorepo (frontend React Native + backend NestJS). La estructura actual tiene inconsistencias acumuladas por desarrollo incremental: archivos mal ubicados, lógica de negocio mezclada con UI, entidades fuera de sus módulos, y mezcla de nomenclatura español/inglés sin criterio. El objetivo es reorganizar para que sea más mantenible y coherente.

---

## FRONTEND (`apps/frontend/src/`)

### Problema 1: Archivos mal ubicados en carpetas incorrectas

**Mover de `providers/` a `screens/`:**
- `providers/EventDetailLinkScreen.tsx` → `screens/EventDetailLinkScreen.tsx`

**Mover de `screens/` a `components/`:**
- `screens/ProfileHeader.tsx` → `components/ProfileHeader.tsx`
- `screens/PrivateEventLinkModal.tsx` → `components/PrivateEventLinkModal.tsx`

**Eliminar barrel redundante:**
- `screens/RoutePreview.tsx` (solo re-exporta RoutePreviewScreen, generar confusión)
- Actualizar `AppNavigator.tsx` para importar directamente desde `screens/RoutePreviewScreen`

### Problema 2: `services/api.ts` monolítico

Dividir en archivos por dominio dentro de `services/`:
- `services/events.ts` — endpoints de eventos (getEvents, attendEvent, rateRecommendedEvent…)
- `services/routes.ts` — endpoints de rutas (createRoute, getRoutes, rateRoute…)
- `services/recommendations.ts` — endpoints de recomendaciones (getRecommendedEvents…)
- `services/users.ts` — getUserProfile, upload foto…
- `services/api.ts` — solo la instancia axios + setAuthToken (infraestructura compartida)
- `services/index.ts` — barrel re-export de todos los servicios

### Problema 3: Importaciones de tipos desde `App.tsx`

Algunos screens importan `RootStackParamList` desde `'../App'`. Deben usar `'../navigation/types'` (ya existe el tipo allí).

Archivos afectados: `CreateEventScreen.tsx`, `CreateRouteScreen.tsx`, `AdminScreen.tsx`

### Problema 4: `seed/events.ts` en bundle de producción

Mover a fuera de `src/` o eliminar si no se usa activamente:
- `src/seed/` → `../dev/seed/` (fuera de src)

### Problema 5: `useNsfwGuard` stub en producción
- Eliminar el import en `EventDetailScreen.tsx` hasta que esté implementado

### Problema 6: Inconsistencia de exports en screens
- Estandarizar a `export default` en todas las screens (ya es la convención de React Native/Expo)
- Actualizar imports en `AppNavigator.tsx`

### Actualizar `components/index.ts`
- Añadir exports de `ProfileHeader` y `PrivateEventLinkModal` tras moverlos

---

## BACKEND (`apps/backend/src/`)

### Problema 1: Entidades en `entities/` global (antipatrón NestJS)

Mover cada entidad a su módulo correspondiente y usar `TypeOrmModule.forFeature()`:

| Entidad actual | Destino |
|---|---|
| `entities/categoria.entity.ts` | `categorias/categoria.entity.ts` |
| `entities/notificacion.entity.ts` | `notificaciones/notificacion.entity.ts` |
| `entities/recomendacion.entity.ts` | `recomendaciones/recomendacion.entity.ts` |
| `entities/ruta.entity.ts` | `rutas/ruta.entity.ts` |
| `entities/calificacion-ruta.entity.ts` | `rutas/calificacion-ruta.entity.ts` |
| `entities/mensaje.entity.ts` | `chat/mensaje.entity.ts` |
| `entities/mensaje-privado.entity.ts` | `chat/mensaje-privado.entity.ts` |
| `entities/resena.entity.ts` | `events/resena.entity.ts` (no tiene módulo propio) |

Después: cada módulo importa `TypeOrmModule.forFeature([...])` en su `*.module.ts`.
`app.module.ts`: quitar los imports individuales de entidades del array `entities:[]`.

### Problema 2: Enums fuera de sus módulos

| Enum | Destino correcto |
|---|---|
| `enums/estado.enum.ts` | `events/enums/estado.enum.ts` |
| `enums/tipo.enum.ts` | `notificaciones/enums/tipo.enum.ts` |
| `users/user.entity.ts` inline `RolEnum` | `users/enums/rol.enum.ts` |

Eliminar `src/enums/` vacío tras el movimiento.

### Problema 3: Inconsistencia de nomenclatura en `common/`

Reorganizar `common/` con subcarpetas:
```
common/
  cloudinary/         (ya existe, mantener)
  utils/
    distance.util.ts  (movida desde common/)
    sevilla-time.ts   (movida desde common/)
  types/
    geojson-point.ts  (interface, movida)
  dto/
    geojson-point.dto.ts (movida)
```

### Problema 4: Archivo DTO mal nombrado

- `users/dto/update-password.ts` → `users/dto/change-password.dto.ts`
- Actualizar imports en `users.controller.ts` y `users.service.ts`

### Problema 5: Directorios vacíos

- Eliminar `src/config/` y `src/dev/` si están vacíos

---

## Archivos críticos a modificar

### Frontend
- `sevillaneando/apps/frontend/src/navigation/AppNavigator.tsx` — actualizar imports tras mover archivos
- `sevillaneando/apps/frontend/src/components/index.ts` — añadir nuevos exports
- `sevillaneando/apps/frontend/src/screens/EventDetailScreen.tsx` — quitar useNsfwGuard
- `sevillaneando/apps/frontend/src/screens/CreateEventScreen.tsx` — fix import RootStackParamList
- `sevillaneando/apps/frontend/src/screens/CreateRouteScreen.tsx` — fix import RootStackParamList
- `sevillaneando/apps/frontend/src/screens/AdminScreen.tsx` — fix import RootStackParamList

### Backend
- `sevillaneando/apps/backend/src/app.module.ts` — quitar entities[] individuales
- Cada `*.module.ts` que reciba entidades — añadir `TypeOrmModule.forFeature`
- `sevillaneando/apps/backend/src/users/dto/update-password.ts` — renombrar
- Todos los archivos que importen desde `entities/` o `enums/` — actualizar rutas

---

## Orden de ejecución recomendado

1. **Backend primero** — los cambios de entidades son más impactantes pero más aislados
2. **Mover enums y entidades** (sin romper imports aún, actualizar referencias después)
3. **Reorganizar common/**
4. **Frontend: mover archivos mal ubicados**
5. **Frontend: dividir api.ts** (más arriesgado, hacerlo último)
6. **Fix imports menores** (RootStackParamList, useNsfwGuard)

## Verificación

- Backend: `cd sevillaneando/apps/backend && npx nest build` — debe compilar sin errores
- Frontend: `cd sevillaneando/apps/frontend && npx tsc --noEmit` — sin errores de tipos
- Arrancar ambos y navegar por las pantallas principales (Home, EventDetail, CreateEvent, Rutas)
