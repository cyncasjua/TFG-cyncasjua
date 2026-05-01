# Plan de Refactorización — Mejora de Rendimiento en HomeScreen

## Diagnóstico de los cuellos de botella

| Problema | Impacto | Ubicación |
|---|---|---|
| `GET /events` devuelve **todos** los eventos sin límite | Alto | `events.service.ts` |
| Cálculo de distancia Haversine en cliente para cada evento | Alto | `HomeScreen.tsx` |
| `fetchEvents()` + `fetchRecommendations()` bloqueantes en cada focus | Alto | `HomeScreen.tsx` |
| Cada link privado en AsyncStorage = 1 request secuencial | Medio | `HomeScreen.tsx` |
| Se carga `asistentes` (JOIN completo) en el listado | Medio | `events.service.ts` |
| Sin caché: todo se recarga en cada `useFocusEffect` | Medio | `HomeScreen.tsx` |

---

## Fase 1 — Backend: Paginación y filtrado en servidor ✅ COMPLETADA

**Objetivo:** Que la BD haga el trabajo pesado en lugar del cliente.

### Cambios implementados:

1. **`FindEventsQueryDto`** — Nuevo DTO con params: `userId`, `lat`, `lng`, `radiusKm`, `limit` (default 50, max 100), `offset`.

2. **`events.service.ts` → `findAll(query)`**:
   - Elimina `leftJoinAndSelect('event.asistentes')` del listado público
   - Solo selecciona campos necesarios de `creador` (id, nombre, fotoPerfil)
   - Cuando se pasa `lat/lng`: calcula `distanceKm` con `ST_Distance` de PostGIS (en servidor, sin Haversine en cliente)
   - Cuando se pasa `radiusKm`: filtra con `ST_DWithin` en la BD
   - Ordena por distancia si hay ubicación, por fecha si no
   - Paginación real con `limit`/`offset` + flag `hasMore` (fetch N+1)
   - Nuevo método `findAllForScheduler()` preserva el comportamiento original con asistentes para el cron

3. **`events.controller.ts`** — Acepta `@Query() FindEventsQueryDto`

4. **`api.ts` → `getEvents(userId?, params?)`** — Nueva firma con params opcionales; retorna `{ events, hasMore }`

5. **`HomeScreen.tsx` → `fetchEvents`** — Pasa `lat/lng` del usuario al servidor; usa `distanceKm` de la respuesta en lugar de calcular Haversine en cliente

---

## Fase 2 — Frontend: Caché con stale-while-revalidate ✅ COMPLETADA

**Objetivo:** La pantalla carga datos instantáneamente desde caché y se actualiza en segundo plano.

1. **Hook `useEvents()`** ✅ — Encapsula fetch + caché en AsyncStorage con TTL de 4 minutos. Al entrar: muestra datos cacheados, lanza fetch en background sin spinner, actualiza si hay cambios.

2. **Separar `fetchRecommendations()` de la carga inicial** — Las recomendaciones se cargan independientemente del listado de eventos.

3. **Pull-to-refresh explícito** ✅ — `RefreshControl` integrado que invalida caché y recarga en background.

---

## Fase 3 — Frontend: Infinite scroll / paginación en FlatList ✅ COMPLETADA

**Objetivo:** Mostrar los primeros 30 eventos inmediatamente, cargar más al hacer scroll.

1. **`onEndReached` en FlatList** ✅ — Implementado con threshold 0.6 (80% del final).
2. **Estado de paginación** ✅ — Hook maneja `pageRef`, `hasMore`, `loadingMore`.
3. **Caché de paginación** ✅ — Los datos se mantienen en `allItemsRef` para carga rápida sin refetch.

---

## Fase 4 — Frontend: Skeleton screens y carga progresiva ✅ COMPLETADA

**Objetivo:** El usuario ve contenido inmediatamente, nunca una pantalla en blanco.

1. **Skeleton cards** ✅ — 6 tarjetas de eventos animadas (shimmer effect) durante carga inicial.
2. **Integración en FlatList** ✅ — Muestra skeletons cuando `loading === true`, eventos reales cuando `loading === false`.
3. **`RefreshControl` unificado** ✅ — Único pull-to-refresh que invalida caché y recarga con revalidación en background.

---

## Orden de implementación

```
Fase 1 (Backend) ✅ → Fase 2 (Caché) ✅ → Fase 3 (Paginación FlatList) ✅ → Fase 4 (Skeletons) ✅
```

---

## Resumen de cambios implementados

### Backend (`events.service.ts`, `events.controller.ts`)

- ✅ Paginación con `limit`/`offset` (max 100 eventos)
- ✅ Cálculo de distancia con PostGIS (`ST_Distance`, `ST_DWithin`)
- ✅ Filtrado geográfico en servidor
- ✅ DTO `FindEventsQueryDto` con validación

### Frontend (`useEvents.ts`, `HomeScreen.tsx`)

- ✅ Hook con caché stale-while-revalidate (TTL 4min)
- ✅ Infinite scroll con `onEndReached`
- ✅ Skeleton screens con animación shimmer
- ✅ Pull-to-refresh integrado
- ✅ Deduplicación de eventos privados/públicos
- ✅ Manejo de ubicación del usuario

### Métricas esperadas

- **Carga inicial**: ~300ms (desde caché)
- **Revalidación**: ~1.5s (en background, sin bloqueo)
- **Infinite scroll**: Instantáneo (datos cacheados)
- **Bundle size**: -0KB (sin dependencias nuevas)
